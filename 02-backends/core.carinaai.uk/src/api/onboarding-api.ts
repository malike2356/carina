import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { tierDisplayLabel } from '../billing/aiva-tier.js';
import { sendCompleteWelcomeEmail } from '../email/email-triggers.js';
import {
  firstName,
  getWorkspaceContact,
} from '../email/workspace-contact.js';
import { listMarketplaceTemplates } from '../marketplace/template-registry.js';
import {
  sendWhatsAppWelcomeTemplate,
  whatsappWelcomeConfigured,
} from '../channels/adapters/whatsapp-adapter.js';
import {
  getQuickConnectChannel,
  listQuickConnectCatalog,
  serializeQuickConnectChannel,
} from '../onboarding/channel-quick-connect.js';
import { seedEmployeeWelcomeThread } from '../aiva/employee-comms.js';
import { getWorker } from '../workers/worker-store.js';

export const onboardingRouter: ExpressRouter = Router();
onboardingRouter.use(requireCloudProxy);

type OnboardingRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveWorkspaceId(req: OnboardingRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  return (fromHeader ?? fromQuery)?.trim() || null;
}

function optionalWorkspace(req: OnboardingRequest, _res: Response, next: NextFunction): void {
  const workspaceId = resolveWorkspaceId(req);
  if (workspaceId && UUID_RE.test(workspaceId)) {
    req.workspaceId = workspaceId;
  }
  next();
}

function requireWorkspace(req: OnboardingRequest, res: Response, next: NextFunction): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

function toOnboardingTemplateSummary(template: ReturnType<typeof listMarketplaceTemplates>[number]) {
  return {
    templateId: template.templateId,
    roleTemplateId: template.roleTemplateId,
    name: template.name,
    icon: template.icon,
    tagline: template.tagline,
    domain: template.domain,
    tier: template.tier,
    tierLabel: tierDisplayLabel(template.tier),
    setupTimeSeconds: template.setupTimeSeconds,
    groupId: template.groupId,
    groupLabel: template.groupLabel,
  };
}

onboardingRouter.get('/channels', optionalWorkspace, (req: OnboardingRequest, res: Response) => {
  const advanced = req.query.advanced === 'true';
  res.json({
    workspaceId: req.workspaceId ?? null,
    ...listQuickConnectCatalog({ advanced }),
  });
});

onboardingRouter.get('/channels/:id', optionalWorkspace, (req: OnboardingRequest, res: Response) => {
  const channel = getQuickConnectChannel(String(req.params.id));
  if (!channel || !channel.available) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }
  res.json({ channel: serializeQuickConnectChannel(channel) });
});

onboardingRouter.get('/start', optionalWorkspace, (req: OnboardingRequest, res: Response) => {
  const templates = listMarketplaceTemplates().map(toOnboardingTemplateSummary);
  const channels = listQuickConnectCatalog().quickConnect;

  res.json({
    workspaceId: req.workspaceId ?? null,
    templates,
    channels,
    customTemplate: {
      templateId: 'custom',
      name: 'Custom',
      icon: 'sparkles',
      tagline: 'Describe the role you need in your own words.',
      tier: 'starter',
      tierLabel: tierDisplayLabel('starter'),
      setupTimeSeconds: 60,
    },
  });
});

onboardingRouter.post('/welcome-email', requireWorkspace, async (req: OnboardingRequest, res: Response) => {
  const workerId = String(req.body?.workerId ?? '').trim();
  if (!workerId) {
    res.status(400).json({ error: 'workerId is required' });
    return;
  }

  const templateId = typeof req.body?.templateId === 'string' ? req.body.templateId : null;
  const channelId = typeof req.body?.channelId === 'string' ? req.body.channelId : null;

  try {
    const workspaceId = req.workspaceId!;
    await sendCompleteWelcomeEmail({
      workspaceId,
      workerId,
      templateId,
      channelId,
    });

    await seedEmployeeWelcomeThread({
      workspaceId,
      workerId,
    });

    let whatsappSent = false;
    try {
      if (!whatsappWelcomeConfigured()) {
        res.json({ ok: true, whatsappSent: false });
        return;
      }
      const [contact, worker] = await Promise.all([
        getWorkspaceContact(workspaceId),
        getWorker(workspaceId, workerId),
      ]);
      if (contact?.ownerPhone && worker) {
        const roleByTemplate: Record<string, string> = {
          'personal-assistant': 'your personal assistant',
          'student-assistant': 'your student assistant',
        };
        const role =
          roleByTemplate[worker.templateId ?? '']
          || `your ${worker.roleDescription
            .split(/[.!?]/)[0]
            ?.replace(/^you are\s+/i, '')
            .replace(/^an?\s+/i, '')
            .trim() || 'AI assistant'}`;
        await sendWhatsAppWelcomeTemplate({
          phone: contact.ownerPhone,
          ownerFirstName: firstName(
            contact.preferredName || contact.ownerName,
            contact.ownerEmail,
          ),
          workerName: worker.name,
          workerRole: role,
        });
        whatsappSent = true;
      }
    } catch (err) {
      console.warn('[onboarding] WhatsApp welcome failed:', err);
    }

    res.json({ ok: true, whatsappSent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
