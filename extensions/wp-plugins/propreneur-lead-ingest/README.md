# Propreneur Lead Ingest (WordPress)

Connect WordPress contact forms to **Propreneur CRM contacts**. Works for any tenant workspace (not tied to one brand).

## Supported form plugins

| Plugin | Hook | Form ID example |
|--------|------|-----------------|
| **Kadence Blocks** Form | `kadence_blocks_form_submission` | `kadence:44_090e99-77` or page HTML `_kb_form_id` |
| **Contact Form 7** | `wpcf7_mail_sent` | `cf7:123` (form post ID) |
| **WPForms** (Lite or Pro) | `wpforms_process_complete` | `wpforms:456` |
| **Fluent Forms** | `fluentform/submission_inserted` | `fluentforms:789` |
| **Elementor Pro** Form widget | `elementor_pro/forms/new_record` | `elementor:contact` (form name from widget) |

**Theme:** Any WordPress theme (Astra, Kadence, etc.). The form plugin matters, not the theme.

**Not yet supported:** Gravity Forms (can be added on request).

**Elementor Free (no Pro):** The Elementor **Form** widget is **Pro-only**. Elementor Free + Astra cannot use the `elementor` adapter. Use one of the free options below instead.

## Requirements

- WordPress 6.0+
- PHP 8.0+
- At least one supported form plugin (see table above)
- A Propreneur tenant workspace (e.g. `https://xelox.propreneur.uk`)
- Propreneur production must have lead ingest enabled (`POST /api/leads/ingest`)

You do **not** need Kadence Blocks Pro or paid webhook addons.

## Install

### Option A: Upload zip

1. Zip this folder so the zip contains `propreneur-lead-ingest/propreneur-lead-ingest.php` at the root of the zip.
2. WordPress admin → **Plugins → Add New → Upload Plugin**.
3. Upload the zip → **Install Now** → **Activate**.

### Option B: Copy files

Copy the whole `propreneur-lead-ingest` folder to:

```
wp-content/plugins/propreneur-lead-ingest/
```

Then **Plugins →** activate **Propreneur Lead Ingest**.

## Configure

1. Go to **Settings → Propreneur Lead Ingest**.
2. **Tenant slug** (required): your workspace subdomain.
   - Example: workspace `https://xelox.propreneur.uk` → slug `xelox`
3. **Ingest URL**: leave as `https://propreneur.uk/api/leads/ingest` unless your host uses a different central URL.
4. **Form providers**: tick Kadence, Contact Form 7, WPForms, and/or Fluent Forms (only installed plugins are hooked).
5. **Which forms**:
   - **All forms** from enabled providers (recommended), or
   - **Listed IDs** only (one per line), e.g. `cf7:42`, `wpforms:15`, `kadence:44_090e99-77`
6. **Debug log**: enable while testing; writes to PHP `error_log` with prefix `[propreneur-lead-ingest]`.
7. Click **Save Changes**.

### Optional: wp-config.php override

Useful when the same site is cloned or slug must not be editable in admin:

```php
define('PROPRENEUR_LEAD_INGEST_TENANT_SLUG', 'xelox');
```

Place above `/* That's all, stop editing! */`.

## Form field labels (all providers)

The plugin maps common field names automatically. Use labels or CF7 field names like:

- First Name / `first-name` / `fname`
- Last Name / `last-name`
- Email / `your-email`
- Phone / `tel`
- Subject
- Message / `comments`

## Provider-specific notes

### Kadence Blocks

1. Add a **Form** block to any page.
2. Enable **Email** under Actions After Submit if you want inbox copies.
3. Form ID: view page source, search `_kb_form_id`.

### Contact Form 7

1. Create a form with mail delivery enabled (default).
2. Form ID: the form’s post ID in **Contact → Contact Forms** (e.g. `123`), or use `cf7:123` in the allow list.

### WPForms

1. Create a form with notification email if desired.
2. Form ID: numeric ID in the WPForms builder URL or entries screen (`wpforms:456`).

### Fluent Forms

1. Create a form; submissions fire after save.
2. Form ID: form ID in Fluent Forms admin (`fluentforms:789`).

### Elementor Pro (Astra + Elementor sites)

1. Requires **Elementor Pro** with the **Form** widget (activating **Elementor One** on the site usually enables this).
2. Add standard fields: Name, Email, Message (field labels are mapped automatically).
3. In the form widget, set a clear **Form name** (e.g. `Contact`) for allow-listing (`elementor:contact`).
4. You can keep Elementor **Email** or **Webhook** actions; this plugin adds CRM ingest separately.
5. Install **Propreneur Lead Ingest** v2.2.0+ and enable **Elementor Pro Form widget** in settings.

### Elementor Free + Astra (e.g. Salim Miah)

Elementor **Free does not include a Form widget**. You have three practical paths:

| Option | Effort | Notes |
|--------|--------|--------|
| **A. Contact Form 7** (recommended) | Low | Free plugin; embed on any Elementor page via shortcode widget |
| **B. WPForms Lite** | Low | Free plugin; drag form widget or shortcode on Elementor page |
| **C. Activate Elementor One / Pro** | Medium | If they own Elementor One, activate it so the native Form widget appears |

**Setup A (CF7) for Salim:**

1. Install **Contact Form 7** from WordPress plugins.
2. Create a form (Name, Email, Subject, Message).
3. On the contact page in Elementor, add a **Shortcode** widget with `[contact-form-7 id="123"]` (use real ID).
4. Install **Propreneur Lead Ingest**; enable **Contact Form 7** in settings (disable Elementor if not Pro).
5. Set **tenant slug** to Salim’s workspace subdomain.
6. Test submit → check Propreneur **Contacts**.

**Setup B (WPForms Lite):** Same idea with WPForms block/shortcode; enable **WPForms** in plugin settings.

**Do not enable** “Elementor Pro Form widget” in plugin settings unless Elementor Pro is actually active.

## What happens on submit

1. Visitor submits the Kadence form.
2. Plugin POSTs JSON to Propreneur ingest API.
3. Propreneur creates or updates workflow:
   - **Contact** in CRM (name, email, phone, type)
   - **Notes** with subject and message
   - **Interaction** note on the timeline
   - **Speed-to-lead** tasks (if enabled on the workspace)

Check **Contacts** in Propreneur within a few seconds.

## Segment detection (from Subject field)

| If subject contains | Segment sent to Propreneur |
|---------------------|----------------------------|
| landlord | landlord |
| deal sourcer, sourcer | deal_sourcer |
| agent, letting agent | agent |
| investor | investor |
| tenant, rent | tenant |
| (empty / other) | investor |

## Per-tenant examples

| Client site | Tenant slug | Notes |
|-------------|-------------|--------|
| xeloxproperties.co.uk | `xelox` | Contact + FAQ forms |
| another-brand.co.uk | `their-slug` | Set in settings per site |

Each WordPress site installs the **same plugin zip**; only the tenant slug (and optional form ID list) changes.

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Email arrives, no CRM contact | Wrong tenant slug; enable debug log; confirm Propreneur deploy includes sync ingest |
| Log: `skip form_id=...` | Form not in allow list; switch to "All forms" or add that ID |
| Log: `ingest failed` | Host blocking outbound HTTPS to `propreneur.uk` |
| Log: `ingest HTTP 4xx/5xx` | Invalid slug or server error; ask platform admin |
| Contact type "Other" | Subject did not match segment keywords; extend subject options or mapping |

### Find a Kadence form ID

1. Open the page on the live site.
2. View page source.
3. Search for `_kb_form_id` (example: `44_090e99-77`).

## Uninstall / migrate from Xelox plugin

If you previously used **Xelox Propreneur lead ingest** (v1.x):

1. Install and configure this plugin.
2. Deactivate the old Xelox plugin.
3. Remove obsolete `define('XELOX_PROPRENEUR_TENANT_SLUG', ...)` from `wp-config.php` unless you still rely on it (still supported).

## API reference (for developers)

**Endpoint:** `POST {ingest_url}` (default `https://propreneur.uk/api/leads/ingest`)

**JSON body:**

```json
{
  "tenant_slug": "xelox",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "",
  "subject": "I am a landlord",
  "message": "Please call me.",
  "source": "example.co.uk/contact",
  "segment": "landlord"
}
```

**Response:** `{"status":"received"}` (HTTP 200)

## Files

| File | Role |
|------|------|
| `propreneur-lead-ingest.php` | Plugin bootstrap |
| `includes/class-propreneur-lead-ingest-settings.php` | Admin settings page |
| `includes/class-propreneur-lead-ingest.php` | Kadence hook and HTTP ingest |

## Changelog

### 2.2.0

- Elementor Pro Form widget support (Astra + Elementor stacks).

### 2.1.0

- Contact Form 7, WPForms, and Fluent Forms support.
- Per-provider enable toggles and prefixed form ID allow list.

### 2.0.0

- Generic multi-tenant plugin with Settings UI.
- Replaces Xelox-only plugin.
