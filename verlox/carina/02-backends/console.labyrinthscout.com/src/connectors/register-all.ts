import { registerConnectorFactory } from './registry.js';
import { CrowdStrikeConnector } from './crowdstrike.js';
import { DefenderConnector } from './defender.js';
import { GenericWebhookConnector } from './generic-webhook.js';
import { JiraConnector } from './jira.js';
import { PagerDutyConnector } from './pagerduty.js';
import { SemgrepConnector } from './semgrep.js';
import { SentinelOneConnector } from './sentinelone.js';
import { ServiceNowConnector } from './servicenow.js';
import { SnykConnector } from './snyk.js';
import { SocketConnector } from './socket.js';
import { WizConnector } from './wiz.js';

const CONNECTOR_FACTORIES = [
  () => new SentinelOneConnector(),
  () => new CrowdStrikeConnector(),
  () => new DefenderConnector(),
  () => new WizConnector(),
  () => new SnykConnector(),
  () => new SocketConnector(),
  () => new SemgrepConnector(),
  () => new JiraConnector(),
  () => new ServiceNowConnector(),
  () => new PagerDutyConnector(),
  () => new GenericWebhookConnector(),
];

export function registerAllConnectors(): void {
  for (const factory of CONNECTOR_FACTORIES) {
    const connector = factory();
    registerConnectorFactory(connector.id, factory);
  }
}

registerAllConnectors();
