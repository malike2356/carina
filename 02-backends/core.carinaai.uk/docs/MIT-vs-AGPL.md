# MIT vs AGPL for Carina builders

Carina (`@verlox/carina-core`) is licensed under the [MIT License](https://opensource.org/licenses/MIT). Some self-hosted AI workspace projects use AGPL-3.0. The difference matters if you build a product or SaaS on top of an agent runtime.

## What MIT allows

The MIT license permits you to:

- Use, copy, and modify the software
- Distribute original or modified versions
- Sublicense and sell products that include the software
- Keep your own application code proprietary

You must include the MIT license notice for Carina's code in distributions of Carina itself. Your separate application code is not automatically subject to MIT unless you choose to license it that way.

## What AGPL-3.0 requires

AGPL-3.0 is a strong copyleft license. If you combine AGPL-covered software with your application and distribute that combined work, or provide it as a network service in a way that triggers AGPL obligations, you generally must make the corresponding source of the combined work available under AGPL.

Practical impact for SaaS:

- Building a hosted product on an AGPL workspace stack commonly requires open-sourcing the SaaS codebase that forms a combined work with the AGPL components.
- AGPL does not automatically force you to open-source unrelated services, but it does reach into code that is part of the combined AGPL-covered program.

## Carina vs AGPL workspaces

| Topic | Carina (MIT) | AGPL workspace |
|-------|--------------|--------------------------------|
| Commercial SaaS on top | You own your proprietary app code | Combined work may need to be AGPL-licensed |
| Private domain logic | Keep it private | Often must be published if part of combined work |
| Runtime license | MIT | AGPL-3.0 |
| Security add-on | Labyrinth Scout (optional, commercial) | Varies by project |

## Practical guidance

- If you want to ship a commercial agent product and keep your business logic closed, MIT is the safer base license for the runtime you embed or extend.
- If you want a fully open stack and plan to open-source your product anyway, AGPL can be acceptable.
- Carina is designed for builders: MIT kernel, optional Scout security, optional hosted mode, and domain packs you can keep private.

## Related docs

- [Commercial boundaries](./kernel/COMMERCIAL_BOUNDARIES.md)
- [Carina capabilities](../capabilities.md)
