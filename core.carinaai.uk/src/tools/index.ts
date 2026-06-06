import { config } from '../config/index.js';
import { propertyDataTool } from '../skills/packs/property-uk/tools/property-data.js';
import { landRegistryTool } from '../skills/packs/property-uk/tools/land-registry.js';
import { registry } from './registry.js';
import { webSearchTool } from './web-search.js';
import { fileReadTool, fileWriteTool } from './file.js';
import { shellExecTool } from './shell.js';
import { httpTool } from './http.js';
import { emailSendTool, emailListTool } from './email.js';
import { codeExecTool } from './code.js';

registry.register(webSearchTool);
registry.register(fileReadTool);
registry.register(fileWriteTool);
registry.register(shellExecTool);
registry.register(httpTool);
registry.register(emailSendTool);
registry.register(emailListTool);
registry.register(codeExecTool);

if (config.propertyData.apiKey) {
  registry.register(propertyDataTool);
}

if (config.landRegistry.apiKey) {
  registry.register(landRegistryTool);
}

export { registry };
