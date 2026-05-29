=== Propreneur Lead Ingest ===
Contributors: verlox
Tags: propreneur, crm, kadence, forms, leads
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 2.1.0
License: GPLv2 or later

Send WordPress form submissions to your Propreneur workspace as CRM contacts.

== Description ==

* Kadence Blocks Form, Contact Form 7, WPForms, and Fluent Forms.
* Configure tenant slug in Settings → Propreneur Lead Ingest.
* Enable or disable each form provider; optional form ID allow list.
* Maps name, email, phone, subject, message into Propreneur lead ingest API.

== Installation ==

1. Zip the `propreneur-lead-ingest` folder or upload via Plugins → Add New.
2. Activate the plugin.
3. Open Settings → Propreneur Lead Ingest.
4. Enter your tenant slug (subdomain before .propreneur.uk).
5. Submit a test form and check Contacts in Propreneur.

== Frequently Asked Questions ==

= What is my tenant slug? =

The subdomain of your workspace URL, e.g. `xelox` for https://xelox.propreneur.uk .

= Can I override slug in wp-config.php? =

Yes: `define('PROPRENEUR_LEAD_INGEST_TENANT_SLUG', 'your-slug');`

== Changelog ==

= 2.1.0 =
* Contact Form 7, WPForms, and Fluent Forms adapters.

= 2.0.0 =
* Generic multi-tenant plugin with admin settings page.
* Replaces Xelox-specific plugin.
