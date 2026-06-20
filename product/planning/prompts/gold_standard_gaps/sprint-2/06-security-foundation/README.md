# Sprint 2 - Category 06: Security Foundation

## What Exists

- `src/security/scout-client.ts` - Emits events to Scout
- `src/security/kill-switch-listener.ts` - Redis pub/sub for kill switch
- `src/security/prompt-guard.ts` - Basic prompt injection detection
- `console.labyrinthscout.com/` - Scout server with trust API and dashboard

## What Is Missing

- Forensics pipeline (dc3dd, volatility, bulk-extractor, plaso, timesketch)
- Secrets rotation automation
- Compliance automation (SOC2 evidence gathering)
- RASP engine (Runtime Application Self-Protection)
- Red team automation (Metasploit, SQLMap, Nikto orchestration via tools)
- Security dashboard in ops.carinaai.uk
- Integration of 72 cyber tools into the tool registry

## Prompts in This Category

- `01-forensics-pipeline.md` - Digital forensics tool chain from disk image to Timesketch
- `02-secrets-rotation.md` - Automated rotation for API keys, DB passwords, JWT secrets
- `03-compliance-automation.md` - SOC2 control evidence gathering and packaging
- `04-rasp-engine.md` - Runtime self-protection: anomaly detection, auto-quarantine
- `05-red-team-automation.md` - Metasploit, SQLMap, Nikto tool wrappers and workflows
- `06-security-dashboard.md` - Ops admin security tab with Scout feed + tool audit log
- `07-72-cyber-tools.md` - Register all 72 cyber tools in the tool registry

## Original Reference

`sprint-2/gap-05-security/`
