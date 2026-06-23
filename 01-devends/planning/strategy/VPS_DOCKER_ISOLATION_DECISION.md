# VPS Docker Isolation Decision

**Date:** 21 June 2026
**Status:** Standing operational policy
**Scope:** VERLOX projects hosted on shared VPS infrastructure

## Decision

Every project that shares a VPS with other projects must run in Docker.

Each project family owns its own Docker network and its own container set. No project may depend on another project's filesystem, process table, or host-level service state.

The only shared bridge is the edge proxy network. The reverse proxy container may join multiple project networks so it can route HTTP and HTTPS traffic. Project networks never join each other directly.

## Why this is the policy

We already saw the failure mode: one host-level service or stale nginx rule can break unrelated projects on the same machine. That creates hidden coupling, hard-to-trace outages, and confusing deploy state.

Docker gives each project an explicit boundary:

- its own internal network
- its own compose file
- its own deploy script
- its own health checks and smoke tests

That makes the blast radius local to the project that failed.

## Network model

### Project networks

Each project family owns its own internal Docker network.

Examples:

- Carina stack: `corecarinaaiuk_carina`
- TuinApp stack: `app_tuinapp_internal`
- Scout stack: `consolelabyrinthscoutcom_scout`
- Propreneur stack: its own isolated network for all Propreneur-family services

### Shared edge network

`proxy` is the only shared network.

Rules:

- the reverse proxy container joins `proxy` and any project network it needs to route
- application containers do not join `proxy` unless they are the edge proxy itself
- project networks never join each other

## Product family rule

Network ownership follows product family, not just DNS name.

`propcalc.uk` is part of the `propreneur` family, even though it has its own domain and deployment root.

That means:

- `propcalc.uk` belongs in the Propreneur Docker network
- it gets its own containers and compose services
- it does not share runtime internals with unrelated projects

## Operational rules

1. One Docker compose stack per project family.
2. One deploy script per project family.
3. One smoke test per project after deploy.
4. No host nginx routing directly to app processes.
5. No supervisor-managed app processes for containerized projects.
6. Explicit network attachment is part of deploy, not a manual step.
7. If a project moves to another VPS, copy that project's compose stack, point DNS, and update the edge proxy only for that project.

## Intended outcome

This keeps shared VPS hosting safe and understandable:

- moving one project does not disturb the others
- stale host services cannot hijack traffic
- deploys are isolated and repeatable
- edge routing remains deliberate and visible

This is now the default rule for shared infrastructure work in VERLOX.
