---
layout: page
title: Labyrinth Scout Documentation
description: Security control plane for autonomous AI agents - prompt injection protection, kill switch, honeypots, anomaly detection, and ERC-8004/8126 on-chain trust attestation.
features:
  - title: Prompt Guard
    details: Three-layer injection detection on every user input and tool response before it reaches your model. Regex, pattern matching, and an LLM judge for novel phrasing.
  - title: Kill Switch
    details: Suspend any agent instance instantly over Redis pub/sub. Carina stops processing within one message. Resume requires operator review.
  - title: Honeypots
    details: Plant decoy API keys and file paths. Any agent access triggers a breach alert immediately. Deception-layer detection for data exfiltration attempts.
  - title: Anomaly Detection
    details: Z-score baselines on per-session metrics. Automatic flagging when tool usage, HTTP requests, or injection attempts spike above normal.
  - title: Live Dashboard
    details: Radar view, event stream, anomaly timeline, and tool heatmap. Three tabs covering posture, defense controls, and governance alignment.
  - title: On-chain Trust
    details: ERC-8004 agent registration and ERC-8126 verification on Base. Weekly attestations from Scout telemetry. Public trust API for third-party gating.
---

<script setup>
import Home from './.vitepress/theme/Home.vue'
</script>

<Home />
