# Admin Navigation - UX Audit & Redesign

**Last updated:** 2026-05-01
**Scope:** Platform admin sidebar (`resources/views/layouts/admin.blade.php`) and supporting nav class (`app/Support/Navigation/PlatformConfigurationLinks.php`)

---

## What Was Wrong (Before)

| Problem | Detail |
|---|---|
| **No grouping** | All items were visual equals in one flat pile. Carina AI sat between User Manager and Platform roles with no conceptual separation. |
| **Wrong icon** | Feature Flags used a shopping cart icon (`M3 3h2l.4 2M7 13h10…`). Completely unrelated to feature flags. |
| **Collapsible group vs flat items** | "Platform configuration" used indented sub-links with no icons, inconsistent with every other nav item that has a full icon + label. |
| **Inconsistent label style** | "User Manager" (title case, action noun), "Platform roles" (sentence case, noun), "SaaS Tenancy" (title case, technical abbreviation), "Feature Flags" (title case). No pattern. |
| **SaaS Tenancy** | Unclear label. Doesn't tell you what you can do there. |
| **Feature Flags location** | A configuration concept stuck between the team management items and a separate "Platform configuration" group - belonged with configuration all along. |
| **AI providers / AI usage** | Appeared as children inside "Platform configuration" group, not associated with Carina AI in any way. |
| **`PlatformConfigurationLinks`** | Returned links with no `icon` field, forcing the layout to handle them specially (as child links without icons). |

---

## The Fix

### Nav Structure (After)

```
Overview

── Workspaces ──
Workspaces

── Team ──
Users
Roles

── AI ──
Carina
AI providers          ← moved from "Platform configuration"
AI usage              ← moved from "Platform configuration"

── Configuration ──
System settings
Feature flags         ← moved out of top-level
Platform keys
Setting definitions
Appearance
```

Sections with no visible items (filtered by feature flags + permissions) are omitted entirely - no empty section labels.

### Design Rules Applied

1. **Section labels** - non-clickable `text-[10px] uppercase tracking-widest text-slate-500` dividers, `mt-5 mb-1 px-3`. No icon on the label itself.
2. **Every nav link has an icon** - consistent `w-4 h-4` Heroicons outline, `stroke-width="1.75"`.
3. **Consistent label style** - sentence case, nouns only: "Workspaces", "Users", "Roles", "Carina", "System settings", "Feature flags".
4. **AI items grouped together** - Carina (the chat tool) + AI providers + AI usage under one AI section. Cognitive load reduced: everything AI is in one place.
5. **Configuration is a catch-all for ops tools** - System settings, Feature flags, Platform keys, Setting definitions, Appearance. These are all "things you configure", not "things you use day to day".
6. **Feature flags use a sliders icon** - `M10.5 6h9.75…` (Heroicons `adjustments-horizontal`). Semantically correct for toggles/flags.

### Files Changed

| File | Change |
|---|---|
| `resources/views/layouts/admin.blade.php` | Replaced the old flat `$nav` array + children-group pattern with a section-aware array. Section items use `'type' => 'section'`. Rendering loop simplified to two branches: section label vs nav link. |
| `app/Support/Navigation/PlatformConfigurationLinks.php` | Added private `ICON_*` constants. Each link now carries an `icon` string (Heroicons path data). Three "Fonts, theme & presets" / "Fonts & appearance" / "Theme presets" variants unified to the single label **"Appearance"**. PHPDoc return types updated. |

---

## Section Logic (Code)

The nav is built as a flat PHP array. Section labels use `['type' => 'section', 'label' => '…']`. Nav links use `['route', 'label', 'match', 'icon']`.

Sections are only appended if they have at least one item (conditional on feature flags + permissions), so the sidebar stays clean for restricted users.

AI section rule: any `PlatformConfigurationLinks` item whose route starts with `admin.ai.` goes into the AI section. Everything else goes into Configuration.

Feature flags position: inserted immediately after `admin.settings.index` in the config list if that item is present, otherwise prepended. This keeps System settings first and Feature flags second - logical reading order (what settings exist → which features are on).

---

## Heroicons Used (Reference)

| Nav item | Icon name | Path prefix |
|---|---|---|
| Overview | `squares-2x2` | `M3.75 6A2.25 2.25…` |
| Workspaces | `building-office` | `M3.75 21h16.5…` |
| Users | `user-group` | `M15 19.128…` |
| Roles | `shield-check` | `M9 12.75L11.25 15…` |
| Carina | `sparkles` | `M9.813 15.904…` |
| AI providers | `cpu-chip` | `M8.25 3v1.5…` |
| AI usage | `chart-bar` | `M3 13.125…` |
| System settings | `cog-6-tooth` | `M9.594 3.94…` |
| Feature flags | `adjustments-horizontal` | `M10.5 6h9.75…` |
| Platform keys | `key` | `M15.75 5.25…` |
| Setting definitions | `clipboard-document-list` | `M9 12h3.75…` |
| Appearance | `paint-brush` | `M9.53 16.122…` |

---

## Cross-references

- Nav class: `app/Support/Navigation/PlatformConfigurationLinks.php`
- Admin layout: `resources/views/layouts/admin.blade.php`
- Platform admin overview: `brain/knowledge/15-platform-admin.md`
- UI components reference: `brain/knowledge/12-ui-components.md`
