import { registry } from './registry.js';
import { registerSessionTool, getSessionTool, listSessionTools, clearSessionTools } from './session-tool-store.js';
export { registerSessionTool, getSessionTool, listSessionTools, clearSessionTools };
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
import { githubAgentSyncTool } from './github-agent-sync-tool.js';
import { contactsTool, createContactsTool } from './contacts-tool.js';
import { skillCuratorTool } from './skill-curator-tool.js';
import { registerPlatformTools } from '../integration/platform/tool.js';
import { imageGenerationTool } from './image-generation.js';
import { checkpointManagerTool } from './checkpoint-manager.js';
import { debugHelpersTool } from './debug-helpers.js';
import { mixtureOfAgentsTool } from './mixture-of-agents.js';
import { computerUseTool } from './computer-use.js';
import { createWeatherForecastTool } from './weather-forecast.js';
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
import { n8nTool } from './n8n.js';
import { trelloTool } from './trello.js';
import { themeTool } from './theme.js';
import { generatePdfTool } from './pdf.js';
import { notesManageTool } from './notes-manage.js';
import { documentsManageTool } from './documents-manage.js';
import { imagesGalleryTool } from './images-gallery.js';
import { secretsAuditTool } from './secrets-audit-tool.js';
import { OPERATOR_UTILITY_TOOLS } from './operator-utils.js';
import { phoneControlTool } from './phone-control.js';
import { NODE_TOOLS } from './node-tools.js';
import { createCyberTools } from './cyber/index.js';
import { blogTools } from './blog.js';
import { RESEARCH_TOOLS } from './research/index.js';
import { generateAndRunTool } from './dynamic/generate-and-run.js';
import { persistRuntimeTool } from './dynamic/persist-tool.js';
import { approveRuntimeTool } from './dynamic/approve-tool.js';
import { setupToolGenAuth } from './dynamic/setup-auth.js';
import { configureCredentialTool } from './configure-credential.js';
import { listCredentialsTool } from './list-credentials.js';
import { channelConfigTool } from './channel-config-tool.js';
import { configureTool } from './configure-tool.js';
import { testCredentialTool } from './test-credential.js';
import { removeCredentialTool } from './remove-credential.js';
import { toolStatusTool } from './tool-status.js';
import { listLiveCapabilitiesTool } from './list-live-capabilities.js';

registry.register(webSearchTool);
registry.register(fileReadTool);
registry.register(fileWriteTool);
registry.register(patchTool);
registry.register(searchFilesTool);
registry.register(shellExecTool);
registry.register(phoneControlTool);
for (const tool of NODE_TOOLS) {
  registry.register(tool, { toolset: 'node' });
}
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
registry.register(createWeatherForecastTool());
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
registry.register(githubAgentSyncTool);
registry.register(contactsTool);
registry.register(skillCuratorTool);
registry.register(generatePdfTool);
registry.register(notesManageTool);
registry.register(n8nTool);
registry.register(trelloTool);
registry.register(themeTool);
registry.register(generateAndRunTool);
registry.register(persistRuntimeTool);
registry.register(approveRuntimeTool);
registry.register(setupToolGenAuth);
registry.register(configureCredentialTool);
registry.register(listCredentialsTool);
registry.register(channelConfigTool);
registry.register(configureTool);
registry.register(testCredentialTool);
registry.register(removeCredentialTool);
registry.register(toolStatusTool);
registry.register(listLiveCapabilitiesTool);
registry.register(documentsManageTool);
registry.register(imagesGalleryTool);
registry.register(secretsAuditTool);
for (const tool of blogTools) {
  registry.register(tool);
}
for (const tool of RESEARCH_TOOLS) {
  registry.register(tool, { toolset: 'research' });
}
for (const tool of OPERATOR_UTILITY_TOOLS) {
  registry.register(tool);
}
for (const tool of createCyberTools()) {
  registry.register(tool);
}
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
  const sessionTools = [
    createTodoTool(sessionId),
    createClarifyTool(sessionId),
    createDelegateTaskTool(sessionId),
    createCronjobTool(sessionId),
    createKanbanTool(sessionId),
    ...createKanbanGranularTools(sessionId),
    ...createBrowserTools(sessionId),
    createContactsTool(sessionId),
  ];
  for (const tool of sessionTools) {
    registerSessionTool(sessionId, tool);
  }
}

void registerBrowserToolsIfAvailable();

export { registry };
