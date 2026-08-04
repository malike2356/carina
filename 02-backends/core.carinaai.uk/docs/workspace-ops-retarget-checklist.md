# Workspace Ops retarget checklist (after discovery answers)

Configure only. Do not fork a thinner product.

1. Bootstrap `{ORG} Ops` under their Google; bind Operations Admin worker  
   `POST /api/aiva/workspace-ops/bootstrap` `{ workerId, orgName }`
2. Retarget persona / display name / optional WhatsApp preference  
   `POST /api/aiva/workspace-ops/retarget` `{ workerId, orgName, workerDisplayName?, missionLine?, preferWhatsApp? }`
3. Prefer channels they already use (often WhatsApp)
4. Budget under £50/month: full product; reduce support retainer, not features
5. Budget £150 to £300: setup + monthly Aiva + light support
6. If need is rostered field workforce: recommend TuinApp as a second product; keep Workspace Ops intact
7. Replace Oak demo seed with their org name (`ORG_NAME=...` on seed script or retarget)
8. Walk close pack: `docs/workspace-ops-close-pack.md` for Thursday (or stated) call

Jack = website. VERLOX = Workspace Ops + Aiva.
