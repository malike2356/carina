# WordPress plugins (Propreneur extensions)

Optional plugins for tenant marketing sites running **WordPress** (Kadence, Astra, Elementor, etc.).

## propreneur-calculators

Embed all 27 Propreneur / Propcalc calculators on any WordPress page via shortcode. Engine runs on Propreneur API.

**Full instructions:** [propreneur-calculators/README.md](./propreneur-calculators/README.md)

### Quick start

1. Zip folder `propreneur-calculators/` and upload via **Plugins → Add New**.
2. Activate **Propreneur Calculators**.
3. **Settings → Propreneur Calculators** → API base URL `https://propreneur.uk`
4. Add shortcode to a page: `[propreneur_calculators]`

## propreneur-lead-ingest

Sends Kadence, Contact Form 7, WPForms, and Fluent Forms submissions to Propreneur CRM contacts.

**Full instructions:** [propreneur-lead-ingest/README.md](./propreneur-lead-ingest/README.md)

### Quick start

1. Zip folder `propreneur-lead-ingest/` and upload via **Plugins → Add New**.
2. Activate **Propreneur Lead Ingest**.
3. **Settings → Propreneur Lead Ingest** → enter **tenant slug** (workspace subdomain, e.g. `xelox`).
4. Keep Kadence **Email** action on the form if you want inbox copies.
5. Submit a test form → check **Contacts** in Propreneur.

### Also documented

- `xeloxproperties/wordpress-faq-to-propreneur-contacts.md` (Xelox-specific form IDs and troubleshooting)
