import { Router } from 'express';
import { carinaJson, carinaPost } from '../lib/carina.js';

export const provisionBusinessRouter = Router();

interface ProvisionSuccess {
  success: true;
  workspaceId: string;
  loginUrl: string;
  customDomainRow?: {
    id: string;
    hostname: string;
    cnameTarget: string;
    cfOwnershipVerificationName: string | null;
    cfOwnershipVerificationValue: string | null;
  } | null;
}

provisionBusinessRouter.get('/', (_req, res) => {
  res.render('provision-business', {
    title: 'Provision Business workspace',
    form: {
      email: '',
      workspaceName: '',
      customDomain: '',
      sendWelcomeEmail: true,
    },
    result: null,
    error: null,
  });
});

provisionBusinessRouter.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  const workspaceName = String(body.workspaceName ?? '').trim();
  const customDomain = String(body.customDomain ?? '').trim();
  const sendWelcomeEmail = body.sendWelcomeEmail === 'on' || body.sendWelcomeEmail === 'true';

  const form = { email, workspaceName, customDomain, sendWelcomeEmail };

  if (!email || !workspaceName) {
    res.status(400).render('provision-business', {
      title: 'Provision Business workspace',
      form,
      result: null,
      error: 'Email and workspace name are required.',
    });
    return;
  }

  try {
    const response = await carinaPost('/api/ops/provision-business', {
      email,
      workspaceName,
      customDomain: customDomain || undefined,
      sendWelcomeEmail,
    });
    const parsed = await carinaJson<ProvisionSuccess>(response);
    if (!parsed.ok || !parsed.data) {
      res.status(parsed.status).render('provision-business', {
        title: 'Provision Business workspace',
        form,
        result: null,
        error: parsed.error ?? 'Provisioning failed.',
      });
      return;
    }
    res.render('provision-business', {
      title: 'Provision Business workspace',
      form: { email: '', workspaceName: '', customDomain: '', sendWelcomeEmail: true },
      result: parsed.data,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('provision-business', {
      title: 'Provision Business workspace',
      form,
      result: null,
      error: message,
    });
  }
});
