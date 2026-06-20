**Carina Manifesto**  
*Carina is the free, open-source kernel for building AI agents. It provides everything an agent needs: tools, memory, channels, model routing, so you can focus on what your agent does, not how it runs.*  
Carina is the free, open-source kernel for building AI agents. Built in Portsmouth, UK by a former student of the University of Portsmouth. MIT licensed. Free forever.  
We built Carina because every team building AI agents should not have to reinvent the same infrastructure. The kernel is the shared foundation; your product is the distro built on top.  
**What is Carina**  
Carina is a constellation in the southern sky. Its name comes from Latin, meaning "keel",  the main structural piece of a ship. In astronomy, it's best known as home to Canopus, the second-brightest star in the night sky, and the site of the massive Carina Nebula. As for this platform: the name fits. The keel is what gives a ship its structure and stability underneath the waterline. The keel is not flashy, but nothing works without it. That's the idea behind Carina the agent too.  
**Agent, Platform or Kernel?**  
Carina is a horizontal agent platform, which means it is the thing that does the work, the thing that makes decisions, the thing that runs tools, and the thing you talk to. All of it. "Agent" is the closest single label: It takes goals, figures out a path, and executes. But It also have tooling, memory, skill packs, gateways across a dozen channels, and a monorepo behind it. So if you want to call it a platform, you're not wrong either. A kernel implies It's a  infrastructure , it's more than that. For now, Call me whatever fits the moment.  
**The problem**  
AI agent stacks are fragmented. Every company rebuilds tools, memory, channel adapters, model routing, and skill systems from scratch. Frameworks solve one layer well but leave the rest to you. The result is duplicated effort, inconsistent security boundaries, and products that cannot share a common upgrade path.  
**What the kernel provides**  
- **Tools registry** - 71 pluggable tools with a stable registration API  
- **Memory and RAG** - episodic memory, semantic search, pluggable backends (PostgreSQL + pgvector)  
- **Model routing** - 23 LLM providers, BYOK, fallback chains, task classification  
- **Channels** - 18 gateway adapters (CLI, web, Telegram, WhatsApp, Slack, API, and more)  
- **Skill and pack system** - 16 domain packs, auto-writer, curator, Hub discovery  
- **MCP** - Model Context Protocol client and server support  
Install the kernel. Add only the packs and channels your product needs.  
**What is not the kernel**  
| | | |  
|-|-|-|  
| **Layer** | **Role** | **License** |   
| **Scout** | Commercial security: injection shield, audit, kill switch, trust verification | Paid |   
| **Carina Ops** | Hosted SaaS: multi-tenant workspace, billing, support | Paid |   
| **Carina Cloud** | Managed browser workspace at app.carinaai.uk | Free tier + paid Ops |   
| **Carina Enterprise** | Support SLAs, custom packs, dedicated hosting for kernel builders | Commercial services |   
| **Products** | Vertical apps built on Carina | Mixed |   
   
   
Scout is optional. Carina runs identically without it. When you need production governance, you add Scout.  
**The Linux analogy**  
| | | |  
|-|-|-|  
| **Layer** | **Linux world** | **Carina world** |   
| Kernel | Linux (GPL, free) | Carina (MIT, free) |   
| Security | SELinux, AppArmor | Scout (commercial) |   
| Enterprise | RHEL, SUSE | [Carina Enterprise / Carina Ops / ](https://carinaai.uk/enterprise "https://carinaai.uk/enterprise")[Carina Cloud](https://carinaai.uk/cloud "https://carinaai.uk/cloud") |   
| Distros | Ubuntu, Fedora | Propreneur, Flitz, COMPASS, ABBIS etc which all run on carina |   
| Packages | apt, pacman | Carina Hub, carina pack install |   
| Modules | Drivers | Tools, MCP servers, community plugins |   
   
   
The core is free. The security layer is commercial. Products say "powered by Carina" or "built on Carina."  
**Who should build on Carina**  
- **ISVs** shipping vertical AI products without rebuilding agent infrastructure  
- **Vertical SaaS** teams that need domain packs, not a chatbot wrapper  
- **Internal platforms** standardising agents across departments with one kernel  
- **Researchers and students** experimenting with tool use, memory, and multi-channel agents under MIT; universities can use Carina for coursework and dissertations via the [University program](https://carinaai.uk/docs/developer/university-program "https://carinaai.uk/docs/developer/university-program")  
If your differentiation is what the agent does (property, healthcare, finance, operations), not how it executes tools, Carina is your kernel.  
**Call to action**  
npm install -g carina-agent  
 carina setup  
   
Next steps:  
1. Try [Carina Cloud or install locally with carina setup](https://carinaai.uk/cloud "https://carinaai.uk/cloud")  
2. Read [Build your first domain pack](https://carinaai.uk/docs/developer/first-domain-pack "https://carinaai.uk/docs/developer/first-domain-pack")  
3. Browse packs at [carinaai.uk/skill-packs](https://carinaai.uk/skill-packs "https://carinaai.uk/skill-packs")  
4. ISVs in production: [Carina Enterprise](https://carinaai.uk/enterprise "https://carinaai.uk/enterprise")  
5. Contribute on [GitHub](https://github.com/malike2356/carina-agent "https://github.com/malike2356/carina-agent")  
6. Educators: see the [University program](https://carinaai.uk/docs/developer/university-program "https://carinaai.uk/docs/developer/university-program")  
**License**  
Carina core is [MIT licensed. Scout is a separate commercial product at ](https://github.com/malike2356/carina-agent/blob/main/LICENSE "https://github.com/malike2356/carina-agent/blob/main/LICENSE")[labyrinthscout.com. You can run, fork, and ship products on Carina without Scout. When you need enterprise security and audit, add Scout.](https://labyrinthscout.com "https://labyrinthscout.com")  
