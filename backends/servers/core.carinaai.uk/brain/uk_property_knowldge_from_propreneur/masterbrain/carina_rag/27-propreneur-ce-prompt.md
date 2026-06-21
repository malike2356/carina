Here is your comprehensive prompt. You can use this with an AI coding assistant like Cursor, or with Claude directly if you share your codebase:

---

**PROPRENEUR PLATFORM REBRAND & RESTRUCTURE PROMPT**

You are working on the Propreneur platform, a SaaS operating system for UK property entrepreneurs. The platform has two versions and a marketing site. You are being asked to implement a comprehensive restructure across all three. Here is everything you need to know and everything you need to do.

---

**CONTEXT AND BACKGROUND**

Propreneur currently has one live version referred to internally as v1. A second version called v2 is being built in parallel. The marketing site is at propreneur.co.uk and the app is at propreneur.uk. The platform serves UK property entrepreneurs and competes by offering a complete operating system rather than individual tools.

The platform includes the following core components across both versions: deal pipeline, property calculators, compliance tracker, investor CRM, general CRM, HR management, accounting, tenant management, landlord management, MentorOS, booking system, and Carina AI assistant.

---

**TASK ONE: REBRAND V1 AS COMMUNITY EDITION**

Rename all references to v1, version one, or the current plan across the entire codebase, marketing site, dashboard, emails, onboarding flows, help documentation, and any user-facing text.

The new name is Propreneur Community Edition, abbreviated as Propreneur CE where space is limited.

Replace every instance of v1 or version 1 with Community Edition or CE as contextually appropriate. This includes but is not limited to page titles, navigation menus, plan names, email templates, onboarding copy, dashboard headers, billing pages, pricing tables, feature lists, and meta descriptions.

The Community Edition should be positioned as the free forever tier designed for property entrepreneurs who are starting out or who want to explore the platform before committing to the full business platform.

---

**TASK TWO: RESTRUCTURE BILLING AND PRICING**

Remove all payment requirements, subscription prompts, and billing flows from the Community Edition entirely. Community Edition is free. There is no trial period, no credit card required, no payment wall, and no expiry date.

Remove any existing trial version or trial period from v2. V2 has no free trial. If users want to try the platform before paying, they use Community Edition. This must be clearly communicated on the pricing page and during any upgrade prompts.

V2, which should now be referred to as Propreneur Business Edition or Propreneur BE throughout all user-facing copy, is fully paid from day one of access. Design the billing flow so that users must complete payment before accessing any Business Edition feature.

Update the pricing page on propreneur.co.uk to reflect the following structure. Community Edition is free forever with clearly listed features and limitations. Business Edition is paid with clearly listed features, pricing tiers if applicable, and a clear upgrade path from Community Edition. The pricing page must make the value difference between the two editions immediately obvious without requiring users to read deeply.

Add an upgrade prompt inside the Community Edition dashboard that appears contextually when users attempt to access a Business Edition feature. The prompt should say something like: this feature is available in Propreneur Business Edition. Your data and settings transfer automatically when you upgrade. No setup required.

---

**TASK THREE: REMOVE SPECIFIED FEATURES FROM COMMUNITY EDITION**

Remove the following features from Community Edition completely. Do not delete the underlying code. Comment it out or gate it behind a feature flag set to false for Community Edition users. The features must remain intact in the codebase for Business Edition.

The features to remove or gate are: PropertyData integration, full Carina AI with platform-provided API access, MentorOS, booking system, and any premium reporting or analytics modules.

For PropertyData specifically: remove the platform-provided integration entirely from Community Edition. Replace it with a Bring Your Own Key field in the Community Edition settings page. The field should be clearly labelled: PropertyData API Key. Add explanatory copy beneath the field that reads: Community Edition users can connect their own PropertyData account using their personal API key. Get your API key at propertydata.co.uk. Business Edition users have PropertyData access included.

For Carina AI specifically: implement full Bring Your Own Key functionality in Community Edition. In the Community Edition settings page, add a section labelled Carina AI Configuration with the following fields: AI Provider with options for Anthropic Claude and DeepSeek, and API Key with a password-masked input field. Add explanatory copy that reads: In Community Edition, Carina is powered by your own AI account. Add your API key above to activate Carina. Business Edition users have Carina fully configured and ready to use with no setup required. Add a link to both Anthropic and DeepSeek API key registration pages.

Ensure that if a Community Edition user has not added their own API key, Carina is gracefully disabled with a clear message explaining how to activate it rather than showing an error.

---

**TASK FOUR: IMPLEMENT COMMUNITY EDITION SUPPORT MODEL**

Remove access to live technical support, support tickets, and direct team contact from Community Edition users.

Community Edition support should be entirely self-service. The following self-service resources must be accessible from within the Community Edition dashboard at all times: inbuilt user manual, feature guides and how-to documentation, video walkthroughs where available, and Carina AI assistant for platform questions if the user has configured their own API key.

Add a support page or help centre section within Community Edition that clearly explains the support model. The copy should read something like: Community Edition includes full access to our knowledge base, user guides, and built-in documentation. For questions about using the platform, ask Carina using your connected AI account. For technical issues, our community forum is available at the link below. Full technical support including direct team access, priority response, and onboarding assistance is available with Propreneur Business Edition.

Do not present this as a limitation. Frame it as a feature of the self-sufficient nature of Community Edition.

Business Edition retains full technical support including direct team contact, priority response times, onboarding calls, and ongoing account management. Make this clearly visible on the Business Edition features list.

---

**TASK FIVE: UPDATE MARKETING SITE TO REFLECT ALL CHANGES**

Update propreneur.co.uk comprehensively to reflect the new platform structure. The following pages require updates.

Homepage: Update the hero section to lead with the Community Edition free offer. The primary call to action should be Get Started Free with no credit card required. Add a secondary call to action for Business Edition. Update the features section to show a clear split between what is available free and what is in Business Edition. Update any screenshots or product mockups if they reference old naming or plan structures.

Pricing page: Rebuild the pricing page to clearly show two tiers. Community Edition free forever and Business Edition paid. For each tier, list every included feature explicitly. Use clear visual differentiation between the two tiers. Add a comparison table if one does not already exist. Include a FAQ section addressing the following questions at minimum: What is the difference between Community and Business Edition. Can I upgrade at any time. Will I lose my data if I upgrade. Is there a free trial for Business Edition. What happens to my data if I cancel Business Edition.

Features page: Update to reflect the BYOK model for Community Edition and the fully managed model for Business Edition. Clearly label which features are CE only, BE only, or available in both.

About or product page if it exists: Update any technical description of the platform to reflect the planned v2 architecture including Laravel 11, Filament 3, Inertia.js, React, shadcn/ui, React Native, Expo, PostgreSQL, and Redis. Frame v2 as the Business Edition infrastructure without using version numbers in user-facing copy.

Blog or news section if it exists: Add a platform update post announcing the Community Edition launch. Keep it benefit-focused and celebratory in tone. Do not use technical language. The message is: Propreneur is now free for property entrepreneurs who are starting out.

SEO meta tags: Update title tags, meta descriptions, and Open Graph tags across all updated pages to reflect the new positioning.

---

**TASK SIX: SIMPLIFY BUSINESS EDITION USER EXPERIENCE**

Throughout the Business Edition interface, audit every feature for complexity and implement the following simplification principles.

Every feature should be accessible within three clicks from the dashboard. If a feature requires more than three clicks to reach from the main navigation, restructure the navigation or add a shortcut.

Every form should have smart defaults pre-populated based on common UK property business use cases. Users should be able to complete any core task with minimum required input.

Add contextual tooltips to every field that is not immediately self-explanatory. Tooltips should be one sentence maximum and written in plain English, not technical language.

Add a getting started checklist to the Business Edition onboarding flow. The checklist should guide new users through the five most important setup steps in order. Mark each step as complete automatically when the user completes the relevant action.

Add progress indicators to any multi-step process including deal creation, compliance setup, tenant onboarding, and accounting configuration.

Implement a universal search bar accessible from every page in Business Edition that searches across deals, properties, contacts, documents, and help articles simultaneously.

---

**TASK SEVEN: UPDATE TERMS AND CONDITIONS**

Add a new section to the Terms and Conditions for Community Edition specifically. This section must be written in plain, warm, non-legal language wherever possible. It must be honest, clear, and not designed to obscure what it is saying.

The section should be titled something like: How We Use Your Data to Improve Propreneur.

The content of this section should communicate the following points in a friendly and transparent way.

When you use Propreneur Community Edition, your anonymised usage patterns and anonymised data interactions help us make Carina smarter and Propreneur better for everyone. We want to be completely upfront about this because we believe you deserve to know.

Here is exactly what this means in practice. We may use anonymised and aggregated data about how you use the platform, which features you use most, what kinds of properties you work with, and how you interact with Carina, to train and improve our AI systems. This data is stripped of all personally identifiable information before it is used for any training purpose. We never use your personal details, your client information, your financial data, or any information that could identify you or anyone connected to your business.

You can think of it this way. By using Community Edition, you are helping build a smarter platform for every property entrepreneur who comes after you. In return, you get a powerful free operating system that we are committed to improving continuously.

If you prefer that your data is not used in this way, Propreneur Business Edition offers full data privacy controls including the option to opt out of all data use for training purposes.

This trade-off should never feel exploitative. Frame it as a community contribution, not a cost. The tone should be warm, collegial, and grateful.

Add a summary box at the top of this section in plain language that reads something like: In Community Edition, anonymised usage data helps us improve Carina and the platform. Your personal data and client information are never used. Business Edition users can opt out entirely.

Ensure this section is linked clearly from the Community Edition onboarding flow, the settings page, and the footer of the platform.

---

**TASK EIGHT: GENERAL IMPLEMENTATION NOTES**

Use feature flags throughout to control what Community Edition and Business Edition users can access. Do not use separate codebases. One codebase, one deployment, feature flags determining the experience.

Every place in the Community Edition where a Business Edition feature is referenced or promoted should include a seamless upgrade path. Never dead-end a user. Always give them a next step.

Maintain full data portability for all users regardless of edition. Every user can export all their data at any time in CSV and JSON formats from their account settings page.

Preserve all existing Community Edition user data and settings during any migration or update. No user should lose any data as a result of these changes.

Log all feature flag states and edition assignments in the audit trail for compliance purposes.

Test every user-facing change across mobile and desktop viewports before deploying.

---

**DELIVERABLES**

When complete, provide a summary of every file changed, every feature flagged, every piece of copy updated, and every billing flow modified. Flag any areas where you encountered ambiguity or where a decision was required that was not covered by this brief so that Laud can review and decide.

---

That is your single comprehensive prompt. Paste it directly into Cursor with your codebase open and it will work through every item systematically.

Do you want me to also write the specific Terms and Conditions section as a standalone polished legal-friendly document you can hand to a solicitor for review?
