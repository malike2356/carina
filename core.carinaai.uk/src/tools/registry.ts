import type { Tool } from '../types/index.js';

type ProviderName = 'anthropic' | 'openai';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  toProviderFormat(provider: ProviderName, tools?: Tool[]): unknown[] {
    const list = tools ?? this.list();
    return list.map((tool) => {
      if (provider === 'anthropic') {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        };
      }
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      };
    });
  }
}

export const registry = new ToolRegistry();
