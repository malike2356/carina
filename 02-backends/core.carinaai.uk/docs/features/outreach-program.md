# Outreach Program (YouTube Channel upgrade)

## Product

Hire Aiva / Carina Cloud path: `/aiva/outreach`

Legacy `/aiva/youtube-channel` redirects into Outreach. YouTube publishing lives at `/aiva/outreach/channels/youtube`.

## O01 / O02 shipped

- Lead, campaign, list, pipeline status, timeline audit
- Sequence engine with Soft Wall (`pending_approval` deliveries; no mass-send)
- Stop on reply, booking, unsubscribe, manual pause
- Business hours + daily cap
- YouTube comment lead import into Outreach
- Feature key: `outreach` (accepts legacy `youtube_channel` / `property_channel` flags)

## Core

- `src/outreach/`
- API: `/api/aiva/outreach`
- Store: `$CARINA_HOME/outreach/outreach-program.json`

## Cloud

- Pages under `app/(workspace)/aiva/outreach/`
- BFF: `/api/aiva/outreach/[...path]`
