import { registry } from './registry.js';
import { webSearchTool } from './web-search.js';
import { fileReadTool, fileWriteTool } from './file.js';
import { shellExecTool } from './shell.js';
import { processTool } from './process.js';
import { httpTool } from './http.js';
import { emailSendTool, emailSmtpSendTool, emailListTool } from './email.js';
import { codeExecTool } from './code.js';
import { memoryTool } from './memory.js';
import { sessionSearchTool } from './session-search.js';
import { textToSpeechTool } from './text-to-speech.js';
import { createTodoTool } from './todo.js';
import { createClarifyTool } from './clarify.js';
import { createDelegateTaskTool } from './delegate-task.js';
import { createCronjobTool } from './cronjob.js';
import { browserTools, createBrowserTools } from './browser/tools.js';
import { checkPlaywright } from './browser/session.js';
import { patchTool } from './patch.js';
import { searchFilesTool } from './search-files.js';
import { sendMessageTool } from './send-message.js';
import { skillManageTool, skillViewTool, skillsListTool } from './skills-tools.js';
import { visionAnalyzeTool } from './vision-analyze.js';
import { transcriptionTool } from './transcription.js';
import { mcpTool } from './mcp.js';
import { webhookTool } from './webhook.js';
import { createKanbanTool } from './kanban.js';
import { createKanbanGranularTools } from './kanban-granular.js';
import { spotifySearchTool, spotifyNowPlayingTool, spotifyPlayTool } from './spotify.js';
import { videoAnalyzeTool } from './video-analyze.js';
import { discordAdminTool } from './discord-admin.js';
import {
  haListEntitiesTool,
  haGetStateTool,
  haListServicesTool,
  haCallServiceTool,
} from './homeassistant-granular.js';
import { feishuChatSendTool, feishuUserLookupTool } from './feishu-granular.js';
import { ybChatTool, ybSearchTool } from './yuanbao-granular.js';
import { lspTool } from './lsp.js';
import { agentSyncTool } from './agent-sync-tool.js';
import { contactsTool } from './contacts-tool.js';
import { skillCuratorTool } from './skill-curator-tool.js';
import { registerPlatformTools } from '../integration/platform/tool.js';
import { imageGenerationTool } from './image-generation.js';
import { checkpointManagerTool } from './checkpoint-manager.js';
import { debugHelpersTool } from './debug-helpers.js';
import { mixtureOfAgentsTool } from './mixture-of-agents.js';
import { computerUseTool } from './computer-use.js';
import { videoGenerationTool } from './video-generation.js';
import {
  discordTool,
  feishuDocTool,
  feishuDriveTool,
  homeassistantTool,
  xSearchTool,
  yuanbaoTool,
  xPostTool,
} from './integrations.js';
import { generatePdfTool } from './pdf.js';

registry.register(webSearchTool);
registry.register(fileReadTool);
registry.register(fileWriteTool);
registry.register(patchTool);
registry.register(searchFilesTool);
registry.register(shellExecTool);
registry.register(processTool);
registry.register(httpTool);
registry.register(emailSendTool);
registry.register(emailSmtpSendTool);
registry.register(emailListTool);
registry.register(codeExecTool);
registry.register(memoryTool);
registry.register(sessionSearchTool);
registry.register(textToSpeechTool);
registry.register(sendMessageTool);
registry.register(skillsListTool);
registry.register(skillViewTool);
registry.register(skillManageTool);
registry.register(visionAnalyzeTool);
registry.register(transcriptionTool);
registry.register(mcpTool);
registry.register(webhookTool);
registry.register(imageGenerationTool);
registry.register(checkpointManagerTool);
registry.register(debugHelpersTool);
registry.register(mixtureOfAgentsTool);
registry.register(computerUseTool);
registry.register(videoGenerationTool);
registry.register(homeassistantTool);
registry.register(xSearchTool);
registry.register(discordTool);
registry.register(feishuDocTool);
registry.register(feishuDriveTool);
registry.register(yuanbaoTool);
registry.register(xPostTool);
registry.register(videoAnalyzeTool);
registry.register(discordAdminTool);
registry.register(spotifySearchTool);
registry.register(spotifyNowPlayingTool);
registry.register(spotifyPlayTool);
registry.register(haListEntitiesTool);
registry.register(haGetStateTool);
registry.register(haListServicesTool);
registry.register(haCallServiceTool);
registry.register(feishuChatSendTool);
registry.register(feishuUserLookupTool);
registry.register(ybChatTool);
registry.register(ybSearchTool);
registry.register(lspTool);
registry.register(agentSyncTool);
registry.register(contactsTool);
registry.register(skillCuratorTool);
registry.register(generatePdfTool);
registerPlatformTools((tool) => registry.register(tool));

for (const tool of createKanbanGranularTools('default-session')) {
  registry.register(tool);
}

registry.register(createTodoTool('default-session'));
registry.register(createKanbanTool('default-session'));
registry.register(createClarifyTool('default-session'));
registry.register(createDelegateTaskTool('default-session'));
registry.register(createCronjobTool('default-session'));

let browserRegistered = false;

export async function registerBrowserToolsIfAvailable(): Promise<boolean> {
  if (browserRegistered) return true;
  const available = await checkPlaywright();
  if (!available) return false;
  for (const tool of browserTools) {
    registry.register(tool);
  }
  browserRegistered = true;
  return true;
}

export function registerSessionTools(sessionId: string): void {
  registry.register(createTodoTool(sessionId));
  registry.register(createClarifyTool(sessionId));
  registry.register(createDelegateTaskTool(sessionId));
  registry.register(createCronjobTool(sessionId));
  registry.register(createKanbanTool(sessionId));
  for (const tool of createKanbanGranularTools(sessionId)) {
    registry.register(tool);
  }
  for (const tool of createBrowserTools(sessionId)) {
    registry.register(tool);
  }
}

void registerBrowserToolsIfAvailable();

export { registry };
