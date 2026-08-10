export {
  generateSPFRecord,
  generateDKIMRecord,
  generateDMARCRecord,
  validateDNSRecords,
  generateSetupGuide,
  type SendingService,
  type DmarcPolicy,
  type DnsTxtRecord,
  type DnsValidationResult,
} from './dns-configurator.js';

export {
  configureTransactionalDomain,
  configureMarketingDomain,
  warmUpDomain,
  getDomainReputation,
  assertFromMatchesRole,
  enforceDomainSeparation,
  type DomainRole,
  type DomainPlan,
  type WarmUpPlan,
} from './domain-separation.js';

export {
  createDeliveryStore,
  trackDelivery,
  classifyBounce,
  calculateInboxRate,
  calculateSpamComplaintRate,
  bounceAnalysis,
  deliveryHealthCheck,
  type DeliveryEvent,
  type DeliveryEventKind,
  type DeliveryStore,
  type BounceClass,
  type HealthAlert,
  type RateWindow,
} from './delivery-monitor.js';

export { emailDeliverabilityPolicy, type EmailDeliverabilityPolicy } from './policy.js';
