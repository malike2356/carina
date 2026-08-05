# Prompt 20: Enterprise, Contacts, and Billing

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

**Billing backend:**
- `src/api/billing-routes.ts` - billing routes (hosted plan)
- `src/api/hosted-billing.ts` - `getHostedPlan()`, `createCheckoutSession()`, `getSubscriptionStatus()`
- `src/api/hosted.ts` - hosted tier management
- `src/api/tenant-keys.ts` - tenant API key management

**Contacts backend:**
- `src/profiles/contacts.ts` - `listContacts()`, `getContact(id)`, `createContact()`, `updateContact()`, `deleteContact()`, `Contact` type

**Billing page (exists):**
- `packages/web/assets/web/billing.html` - billing page (check line count)
- Served at GET `/billing` with `{ workspacePage: undefined }` (check actual decorator opts)

**Tenant API keys:**
- `src/api/tenant-keys.ts` - routes for API key management under `/api/tenant-keys`

## Part A: Enhance billing page

Read `packages/web/assets/web/billing.html` to understand current state. The billing page likely shows plan status and an upgrade button.

### Add subscription details to the billing page

The billing page should show:
- Current plan name (free / pro / enterprise)
- Usage: requests this billing period, token count, storage used
- Next renewal date and amount
- "Manage subscription" link (Stripe customer portal)
- "View invoices" list

Check `src/api/billing-routes.ts` for existing routes. Ensure the following exist:

```typescript
// In billing-routes.ts or alongside it:
billingRouter.get('/status', requireHostedSession, async (req, res) => {
  const status = await getSubscriptionStatus(req.hostedUser!.id);
  res.json(status);
});

billingRouter.get('/invoices', requireHostedSession, async (req, res) => {
  // List invoices from Stripe or stored records
  const invoices = await listInvoices(req.hostedUser!.id);
  res.json({ invoices });
});

billingRouter.post('/portal', requireHostedSession, async (req, res) => {
  // Create Stripe billing portal session
  const url = await createPortalSession(req.hostedUser!.id, req.body?.returnUrl);
  res.json({ url });
});
```

**Billing page additions in billing.html:**

Add a subscription status section:
```html
<div id="billing-status" class="billing-card" style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:0.85rem;">
  <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;">
    <span style="font-size:0.84rem;font-weight:600;">Current plan</span>
    <span id="plan-badge" style="font-size:0.68rem;text-transform:uppercase;padding:0.1rem 0.4rem;border-radius:4px;background:rgba(108,140,255,0.12);color:var(--accent);">Loading...</span>
  </div>
  <div id="plan-details" style="font-size:0.78rem;color:var(--muted);line-height:1.6;"></div>
  <div style="margin-top:0.75rem;display:flex;gap:0.5rem;">
    <button id="manage-sub-btn" style="background:var(--accent);color:#0d0d0f;border:none;border-radius:8px;padding:0.45rem 0.85rem;font-size:0.82rem;font-weight:700;cursor:pointer;">Manage subscription</button>
  </div>
</div>

<div style="font-size:0.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.4rem;">Invoices</div>
<div id="invoice-list"></div>
```

JS additions for billing page (add to billing page script or a new `billing-ext.js`):

```javascript
// Load subscription status
fetch('/api/billing/status')
  .then(function(r){return r.json();})
  .then(function(d) {
    var badge = document.getElementById('plan-badge');
    var details = document.getElementById('plan-details');
    if (badge) badge.textContent = d.plan || 'free';
    if (details) {
      details.innerHTML =
        (d.renewsAt ? 'Renews: ' + new Date(d.renewsAt).toLocaleDateString() + '<br>' : '') +
        (d.amount ? 'Amount: ' + d.amount + '<br>' : '') +
        (d.requests != null ? 'Requests this period: ' + d.requests : '');
    }
  })
  .catch(function() {});

// Manage subscription
var manageBtn = document.getElementById('manage-sub-btn');
if (manageBtn) {
  manageBtn.addEventListener('click', function() {
    manageBtn.disabled = true;
    fetch('/api/billing/portal', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ returnUrl: window.location.href }),
    }).then(function(r){return r.json();}).then(function(d) {
      if (d.url) window.location.href = d.url;
    }).catch(function() { manageBtn.disabled = false; });
  });
}

// Load invoices
fetch('/api/billing/invoices')
  .then(function(r){return r.json();})
  .then(function(d) {
    var listEl = document.getElementById('invoice-list');
    if (!listEl) return;
    var invoices = d.invoices || [];
    if (!invoices.length) {
      listEl.innerHTML = '<div style="font-size:0.82rem;color:var(--muted);">No invoices yet.</div>';
      return;
    }
    listEl.innerHTML = invoices.map(function(inv) {
      return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.8rem;">' +
        '<div style="flex:1;">' + escapeHtml(inv.date ? new Date(inv.date).toLocaleDateString() : inv.id) + '</div>' +
        '<div style="color:var(--muted);">' + escapeHtml(inv.amount || '') + '</div>' +
        (inv.pdfUrl ? '<a href="' + escapeHtml(inv.pdfUrl) + '" target="_blank" style="color:var(--accent);font-size:0.72rem;">PDF</a>' : '') +
      '</div>';
    }).join('');
  })
  .catch(function(){});
```

## Part B: Contacts page

### Step 1: Add `'contacts'` to `WorkspacePageId` in `packages/web/src/workspace-chrome.ts`

```typescript
| 'contacts'
```

### Step 2: Add nav item

```typescript
{
  id: 'contacts',
  href: '/contacts',
  label: 'Contacts',
  description: 'Manage contacts for outreach and channels',
},
```

### Step 3: Create `src/api/contacts-api.ts`

```typescript
import { Router, type Request, type Response } from 'express';
import {
  listContacts, getContact, createContact, updateContact, deleteContact,
} from '../profiles/contacts.js';

export const contactsApiRouter = Router();

contactsApiRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const contacts = listContacts();
  const filtered = q ? contacts.filter(function(c) {
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  }) : contacts;
  res.json({ contacts: filtered, total: contacts.length });
});

contactsApiRouter.get('/:id', (req, res) => {
  const c = getContact(req.params.id);
  if (!c) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(c);
});

contactsApiRouter.post('/', async (req, res) => {
  const { name, email, phone, notes, tags } = req.body ?? {};
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const contact = await createContact({ name, email, phone, notes, tags });
    res.status(201).json(contact);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

contactsApiRouter.patch('/:id', async (req, res) => {
  try {
    const contact = await updateContact(req.params.id, req.body);
    res.json(contact);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

contactsApiRouter.delete('/:id', async (req, res) => {
  try {
    await deleteContact(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

Mount in `createWebServer()`:
```typescript
import { contactsApiRouter } from '#core/api/contacts-api.js';
app.use('/api/contacts', express.json(), requireAuth, contactsApiRouter);
```

### Step 4: Load contacts HTML in `createWebServer()`

```typescript
const contactsHtml = decoratePageHtml(
  await fs.readFile(path.join(WEB_STATIC, 'contacts.html'), 'utf-8').catch(() => null),
  carinaVersion,
  { workspacePage: 'contacts' },
);
if (contactsHtml) {
  app.get('/contacts', (_req, res) => { res.type('html').send(contactsHtml); });
}
app.get('/contacts.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'contacts.js'));
});
```

### Step 5: Create `packages/web/assets/web/contacts.html`

Two-panel layout: list on left, detail/edit on right.

Key elements:
- Search input at top of list
- "New contact" button
- Contact list: name, email badge, tag chips
- Right panel: name input, email, phone, notes textarea, tags, save and delete buttons
- Empty state list: "No contacts. Add one or ask Carina to save a contact from a conversation."
- Empty state detail: "Select a contact to view or edit."

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0d0d0f">
<title>Contacts; Carina</title>
<style>
  body { display:flex; flex-direction:column; height:100vh; }
  .contacts-layout { flex:1; display:grid; grid-template-columns:280px 1fr; min-height:0; overflow:hidden; }
  .contact-list-pane { border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface-2); }
  .list-head { padding:0.65rem; border-bottom:1px solid var(--border); display:flex; gap:0.4rem; }
  .list-head input { flex:1; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:0.35rem 0.55rem; font-size:0.8rem; }
  .list-head button { background:var(--accent); color:#0d0d0f; border:none; border-radius:6px; padding:0.35rem 0.6rem; font-size:0.78rem; font-weight:700; cursor:pointer; white-space:nowrap; }
  .contact-list { flex:1; overflow-y:auto; padding:0.35rem; }
  .contact-item { padding:0.55rem 0.65rem; border-radius:8px; cursor:pointer; margin-bottom:0.2rem; border:1px solid transparent; }
  .contact-item:hover { background:var(--surface); }
  .contact-item.active { background:var(--surface); border-color:var(--border); }
  .c-name { font-size:0.84rem; font-weight:600; }
  .c-email { font-size:0.7rem; color:var(--muted); margin-top:0.1rem; }
  .contact-detail { display:flex; flex-direction:column; padding:1.25rem; overflow-y:auto; }
  .detail-field { display:flex; flex-direction:column; gap:0.2rem; margin-bottom:0.75rem; }
  .detail-label { font-size:0.72rem; color:var(--muted); }
  .detail-field input, .detail-field textarea {
    background:var(--surface-2); border:1px solid var(--border); color:var(--text);
    border-radius:6px; padding:0.45rem 0.6rem; font-size:0.82rem; font-family:inherit;
  }
  .detail-field textarea { min-height:80px; resize:vertical; }
  .detail-actions { display:flex; gap:0.5rem; margin-top:auto; padding-top:0.75rem; }
  .btn-save { background:var(--accent); color:#0d0d0f; border:none; border-radius:8px; padding:0.5rem 1rem; font-weight:700; cursor:pointer; font-size:0.82rem; }
  .btn-delete { background:none; border:1px solid var(--border); color:var(--danger); border-radius:8px; padding:0.5rem 1rem; cursor:pointer; font-size:0.82rem; }
</style>
</head>
<body>
<!--CARINA_WORKSPACE_BEGIN-->
<header class="ws-page-header">
  <h1>Contacts</h1>
  <span class="status" id="status"></span>
</header>
<div class="contacts-layout">
  <div class="contact-list-pane">
    <div class="list-head">
      <input id="contact-search" placeholder="Search contacts...">
      <button id="new-contact">New</button>
    </div>
    <div class="contact-list" id="contact-list"></div>
  </div>
  <div class="contact-detail" id="contact-detail">
    <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.85rem;" id="detail-empty">
      Select a contact or create a new one.
    </div>
    <div id="detail-form" hidden style="display:flex;flex-direction:column;flex:1;">
      <input type="hidden" id="detail-id">
      <div class="detail-field"><label class="detail-label">Name</label><input id="detail-name" required></div>
      <div class="detail-field"><label class="detail-label">Email</label><input id="detail-email" type="email"></div>
      <div class="detail-field"><label class="detail-label">Phone</label><input id="detail-phone" type="tel"></div>
      <div class="detail-field"><label class="detail-label">Tags (comma-separated)</label><input id="detail-tags"></div>
      <div class="detail-field" style="flex:1;"><label class="detail-label">Notes</label><textarea id="detail-notes"></textarea></div>
      <div id="detail-save-status" style="font-size:0.75rem;color:var(--muted);"></div>
      <div class="detail-actions">
        <button class="btn-save" id="save-contact">Save</button>
        <button class="btn-delete" id="delete-contact">Delete</button>
      </div>
    </div>
  </div>
</div>
<!--CARINA_WORKSPACE_END-->
<script src="/contacts.js"></script>
</body>
</html>
```

### Step 6: Create `packages/web/assets/web/contacts.js`

Full IIFE with:
- `loadContacts(q)` - GET /api/contacts/?q=... render list, skeleton while loading
- `openContact(id)` - GET /api/contacts/:id populate form, show detail pane
- `#new-contact` click: clear form, set `#detail-id` to empty, show form
- `#save-contact` click: if id empty POST /api/contacts/, else PATCH /api/contacts/:id
- `#delete-contact` click: confirm then DELETE /api/contacts/:id, reload list, clear detail
- Search input debounced 250ms calls `loadContacts(q)`
- Empty state shown when no contacts match search

## Tests

Create `src/api/contacts-api.test.ts`:
- GET /api/contacts/ returns `{ contacts: [], total: 0 }` when empty
- POST /api/contacts/ with missing name returns 400
- POST /api/contacts/ with valid body returns 201 with Contact
- PATCH /api/contacts/:id updates and returns updated contact
- DELETE /api/contacts/:id returns 204
- GET /api/contacts/:id returns 404 for unknown id
- GET /api/contacts/?q=alice filters by name

For billing routes (add to existing billing tests):
- GET /api/billing/status returns plan info
- GET /api/billing/invoices returns `{ invoices: [] }` when none

## Acceptance criteria

- `/contacts` is a full two-panel contact manager with search, create, edit, delete
- Contacts are stored persistently across restarts (via `src/profiles/contacts.ts`)
- Billing page shows current plan, renewal date, and invoice list
- "Manage subscription" redirects to Stripe customer portal
- All contacts API routes require authentication
