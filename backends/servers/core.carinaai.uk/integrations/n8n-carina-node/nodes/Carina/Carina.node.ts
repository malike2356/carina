import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class CarinaNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Carina',
    name: 'carina',
    icon: 'file:carina.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{ $parameter["prompt"].slice(0, 60) }}',
    description: 'Send a task to Carina AI agent and get the response.',
    defaults: { name: 'Carina' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: 'carinaApi', required: true }],
    properties: [
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        typeOptions: { rows: 4 },
        required: true,
        default: '',
        placeholder: 'Summarize this email: {{ $json.body }}',
        description: 'What you want Carina to do. Supports n8n expressions to reference previous node data.',
      },
      {
        displayName: 'System Prompt',
        name: 'systemPrompt',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        description: 'Optional context for Carina. E.g. "You are analyzing property investment leads."',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: '',
        description:
          'Optional session key for conversation continuity across workflow runs. Leave blank for a fresh session each time.',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        options: [
          {
            displayName: 'Model Override',
            name: 'model',
            type: 'string',
            default: '',
            placeholder: 'deepseek-chat',
            description: 'Override the LLM model. Leave blank to use Carina default.',
          },
          {
            displayName: 'Domain Pack',
            name: 'pack',
            type: 'string',
            default: '',
            placeholder: 'property-uk',
            description: 'Skill pack to activate for this request.',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('carinaApi');
    const baseUrl = String(credentials.baseUrl ?? 'https://app.carinaai.uk').replace(/\/$/, '');
    const apiKey = String(credentials.apiKey ?? '');
    const timeoutMs = Number(credentials.timeout ?? 120) * 1000;

    for (let i = 0; i < items.length; i++) {
      const prompt = this.getNodeParameter('prompt', i, '') as string;
      const systemPrompt = this.getNodeParameter('systemPrompt', i, '') as string;
      const sessionId = this.getNodeParameter('sessionId', i, '') as string;
      const options = this.getNodeParameter('options', i, {}) as IDataObject;

      if (!prompt.trim()) {
        throw new NodeOperationError(this.getNode(), 'Prompt is required', { itemIndex: i });
      }

      const body: IDataObject = { prompt: prompt.trim() };
      if (sessionId) body.sessionId = sessionId;
      if (systemPrompt) body.systemPrompt = systemPrompt;
      if (options.model) body.model = options.model;
      if (options.pack) body.pack = options.pack;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/acp/prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('abort') || msg.includes('timeout')) {
          throw new NodeOperationError(
            this.getNode(),
            `Carina did not respond within ${Number(credentials.timeout ?? 120)} seconds.`,
            { itemIndex: i },
          );
        }
        throw new NodeOperationError(
          this.getNode(),
          `Cannot reach Carina at ${baseUrl}. Is it running? Error: ${msg}`,
          { itemIndex: i },
        );
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errBody = await response.json() as IDataObject;
          errorDetail = String(errBody.error ?? errBody.message ?? '');
        } catch {
          errorDetail = await response.text().catch(() => '');
        }
        throw new NodeOperationError(
          this.getNode(),
          `Carina returned ${response.status}${errorDetail ? ': ' + errorDetail : ''}.`,
          { itemIndex: i },
        );
      }

      const contentType = response.headers.get('content-type') ?? '';

      let responseText: string;
      let returnedSessionId: string | undefined;

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) throw new NodeOperationError(this.getNode(), 'Empty response stream', { itemIndex: i });
        const decoder = new TextDecoder();
        const chunks: string[] = [];
        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            const text = decoder.decode(value, { stream: !done });
            for (const line of text.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              try {
                const parsed = JSON.parse(line.slice(6)) as IDataObject;
                if (parsed.type === 'text' && parsed.content) chunks.push(String(parsed.content));
                if (parsed.sessionId) returnedSessionId = String(parsed.sessionId);
              } catch {
                /* skip malformed lines */
              }
            }
          }
        }
        responseText = chunks.join('');
      } else {
        const json = await response.json() as IDataObject;
        responseText = String(json.response ?? json.content ?? json.text ?? json.reply ?? '');
        returnedSessionId = json.sessionId ? String(json.sessionId) : undefined;
      }

      results.push({
        json: {
          response: responseText,
          sessionId: returnedSessionId ?? sessionId,
          prompt: prompt.trim(),
          baseUrl,
        },
      });
    }

    return [results];
  }
}
