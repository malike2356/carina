# Propreneur Calculators (WordPress)

Embed all **27** Propreneur / Propcalc property calculators on any WordPress page. The **calculation engine runs on Propreneur**; WordPress only displays the UI via iframe + catalog API.

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Outbound HTTPS to your Propcalc base URL (default `https://propcalc.uk`)

## Install

1. Zip the `propreneur-calculators/` folder (or upload the folder to `wp-content/plugins/`).
2. **Plugins → Activate → Propreneur Calculators**.
3. **Settings → Propreneur Calculators**
   - **API base URL:** `https://propcalc.uk`
   - **Default calculator:** e.g. `strategy_finder` or `brr`

## Shortcodes

### Full hub (all 27 calculators on one page)

```
[propreneur_calculators]
```

Optional attributes:

```
[propreneur_calculators default="brr" height="900"]
```

- Sidebar lists all calculators (grouped: strategies, tools, utilities)
- Main area loads the selected calculator in an iframe
- Engine: `POST https://propcalc.uk/calculators/{slug}/run` (from inside the embed)

### Single calculator

```
[propreneur_calculator slug="brr"]
```

```
[propreneur_calculator slug="sdlt" height="760" title="SDLT calculator"]
```

## How it works

| Layer | URL |
|-------|-----|
| **Catalog API** | `GET {base}/calculators/catalog` |
| **Embed UI** | `GET {base}/calculators/{slug}/embed` |
| **Calculate** | `POST {base}/calculators/{slug}/run` |
| **Show working** | `POST {base}/calculators/{slug}/working` |

WordPress fetches the catalog (cached 60 minutes by default) and renders iframes. No calculator logic is duplicated in PHP.

## Kadence / Elementor / Astra

Add a **Shortcode** block (or Shortcode widget) and paste:

```
[propreneur_calculators]
```

Use a full-width page template for best results.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Red error box on page | Check **Settings → API base URL**; server must reach `/calculators/catalog` |
| Blank iframe | Confirm `{base}/calculators/brr/embed` loads in a browser tab |
| Old calculator list | Lower cache minutes in settings or wait for transient expiry |

## Related plugin

**Propreneur Lead Ingest** sends WordPress form submissions to Propreneur CRM. These plugins work together on tenant marketing sites.

## API reference (Propreneur)

Implemented in `propreneur-v2`:

- `GET /calculators/catalog` — JSON list of 27 calculators
- `GET /calculators/{slug}/embed` — iframe-friendly calculator (allowed in external sites via CSP `frame-ancestors`)

See `tests/Feature/Propcalc/PropcalcCatalogEmbedTest.php`.
