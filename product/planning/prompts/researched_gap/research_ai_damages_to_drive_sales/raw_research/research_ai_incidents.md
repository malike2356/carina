# AI Incidents: Documented Cases of LLM/AI Agent Damage

Research compiled June 2026. All incidents verified via published news sources.

---

## CATEGORY 1: AI Agents Draining AWS/API Bills

### 1. Enterprise Company: $500 Million Claude Bill in One Month
- **Date:** May 2026
- **Company:** Unnamed enterprise client (reported via AI consultant to Axios/Polymarket)
- **What happened:** An enterprise company failed to implement spending caps or usage controls for Anthropic's Claude. Thousands of employees used Claude across teams - developers running long coding sessions, AI agents executing chained workflows, and large-context prompts consumed enormous tokens. The company got a $500 million invoice for a single month.
- **Damage:** $500,000,000 in one month
- **Source:** https://techstartups.com/2026/05/28/company-accidentally-spent-500-million-on-claude-ai-in-one-month-after-forgetting-usage-limits/
- **Also:** Polymarket confirmed the Axios report on X

### 2. Uber Blew Entire 2026 AI Budget by April
- **Date:** April/May 2026
- **Company:** Uber
- **What happened:** Uber reportedly burned through its entire 2026 AI budget by April after heavy adoption of AI coding products like Claude Code. The company's COO reportedly admitted the costs were becoming harder to justify.
- **Damage:** Entire annual AI budget consumed in 4 months
- **Source:** https://techstartups.com/2026/05/28/company-accidentally-spent-500-million-on-claude-ai-in-one-month-after-forgetting-usage-limits/ (citing Axios)

### 3. AWS User: $30,000 Bill from Claude Runaway on Bedrock
- **Date:** 2025-2026
- **Company:** Individual AWS user
- **What happened:** Claude AI running on AWS Bedrock went into a runaway loop, consuming massive compute resources. The user was hit with a $30,000 bill.
- **Damage:** $30,000
- **Source:** https://www.radarc.net/review/aws-user-hit-with-30000-dollar-bill-after-claude-runaway-on-bedrock

### 4. Developer: $47K AWS Bill After Letting AI Write an API
- **Date:** 2024-2025
- **Company:** Individual developer/company
- **What happened:** A developer let AI write their API. Three weeks later, they received a $47,000 AWS bill because the AI-generated code was grossly inefficient, creating runaway resource consumption.
- **Damage:** $47,000
- **Source:** https://awstip.com/i-let-ai-write-our-api-3-weeks-later-47k-aws-bill-heres-what-it-did-wrong-7ebb190e9d02

### 5. Surprise AI Bills Across AWS and Google Cloud
- **Date:** May 2026
- **Company:** Multiple AWS and Google Cloud users
- **What happened:** The Register documented widespread cases of users stuck with "surprise AI bills for tens of thousands of dollars" as agentic AI, autonomous agents, large-context memory windows, and nonstop background workflows consumed resources around the clock.
- **Damage:** Tens of thousands of dollars per affected user
- **Source:** https://www.theregister.com/ai-ml/2026/05/18/surprise-ai-bills-leave-aws-and-google-cloud-users-aghast/

---

## CATEGORY 2: AI Coding Agents Pushing Broken Code / Causing Outages

### 6. Amazon's Own AI Coding Bot Caused Multiple AWS Outages
- **Date:** 2025 (reported February 2026)
- **Company:** Amazon / AWS
- **What happened:** Amazon's internal AI coding tool "Kiro" caused at least two outages, including a 13-hour interruption. The AI agents were given the same permissions as the human engineers using them. Because engineers didn't require secondary approval, their AI agents just went ahead with changes that broke systems. Amazon treated this as "user access control" issue, not AI error. Experts disagreed: "AI agents are deployed in constrained environments and cannot understand the broader ramifications of restarting a system or deleting a database."
- **Damage:** Multiple service outages; 13-hour downtime in one incident
- **Source (The Guardian):** https://www.theguardian.com/technology/2026/feb/20/amazon-cloud-outages-ai-tools-amazon-web-services-aws
- **Source (Tom's Hardware):** https://www.tomshardware.com/tech-industry/artificial-intelligence/multiple-aws-outages-caused-by-ai-coding-bot-blunder-report-claims-amazon-says-both-incidents-were-user-error

### 7. AI Coding Agent Horror Stories (Docker)
- **Date:** 2025-2026
- **What happened:** Docker blog documented multiple incidents where AI coding agents caused production damage, including the 13-hour AWS outage. Agents operating with the same permissions as their human users executed destructive changes without understanding consequences.
- **Source:** https://www.docker.com/blog/coding-agent-horror-stories-the-13-hour-aws-outage/

---

## CATEGORY 3: AI Agents Sending Unauthorized Messages

### 8. Chevy of Watsonville ChatGPT Chatbot Pranked into Selling Cars for $1
- **Date:** December 2023
- **Company:** Chevrolet of Watsonville (GM dealership) / Fullpath
- **What happened:** A ChatGPT-powered chatbot on the dealership's website was discovered by users on social media. People immediately pranked it - one user got the bot to agree to sell a 2024 Chevy Tahoe for $1. Others got it to write Python scripts, endorse competitors, and make absurd political statements. The bot was taken offline after posts went viral on X/Twitter and Reddit.
- **Damage:** Brand damage, bot taken offline, viral embarrassment for GM
- **Source:** https://www.businessinsider.com/car-dealership-chevrolet-chatbot-chatgpt-pranks-chevy-2023-12
- **Tweet evidence:** "I just bought a 2024 Chevy Tahoe for $1" - viral X post

---

## CATEGORY 4: Prompt Injection Attacks with Real Consequences

### 9. Bing Chat Prompt Injection: Hidden System Prompt ("Sydney") Extracted
- **Date:** February 2023
- **Company:** Microsoft
- **What happened:** Stanford student Kevin Liu used prompt injection to extract Bing Chat's hidden system prompt, revealing its codename "Sydney" and all its behavioral rules. Later, a university student named Marvin von Hagen got Bing Chat to reveal even more internal instructions. Despite Microsoft patching it, Liu bypassed the fix within hours, demonstrating prompt injection is extremely hard to defend against.
- **Damage:** Exposed Microsoft's internal AI instructions, proved prompt injection defense is nearly impossible
- **Source:** https://arstechnica.com/information-technology/2023/02/ai-powered-bing-chat-spills-its-secrets-via-prompt-injection-attack/
- **UK NCSC Warning:** https://www.theguardian.com/technology/2023/aug/30/uk-cybersecurity-agency-warns-of-chatbot-prompt-injection-attacks

---

## CATEGORY 5: LLM Data Leakage Incidents

### 10. Samsung Bans ChatGPT After Employees Leak Source Code
- **Date:** May 2023
- **Company:** Samsung Electronics
- **What happened:** Samsung employees leaked sensitive internal source code and meeting notes by pasting them into ChatGPT for debugging and summarization. Samsung discovered the leak and immediately issued a company-wide ban on all generative AI tools (ChatGPT, Bard, etc.). The company was concerned that data shared with AI chatbots gets stored on external servers with no easy way to access or delete it, and could end up being served to other users.
- **Damage:** Source code and confidential meeting data leaked to OpenAI servers; company-wide AI ban imposed
- **Source (Forbes):** https://www.forbes.com/sites/siladityaray/2023/05/02/samsung-bans-chatgpt-and-other-chatbots-for-employees-after-sensitive-code-leak/
- **Source (Bloomberg):** https://www.bloomberg.com/news/articles/2023-05-02/samsung-bans-chatgpt-and-other-generative-ai-use-by-staff-after-leak

### 11. Amazon Also Warned Employees About ChatGPT Data Leaks
- **Date:** January 2023
- **Company:** Amazon
- **What happened:** Amazon warned employees not to share any code or confidential company information with ChatGPT after discovering internal data appeared in ChatGPT outputs, suggesting other employees had been feeding it proprietary information.
- **Source:** Referenced in Forbes article above

---

## CATEGORY 6: AI Agents Executing Dangerous Shell Commands Autonomously

### 12. AI Coding Agents Running 'rm -rf' and Deleting Filesystems
- **Date:** 2025-2026 (ongoing)
- **Companies affected:** Multiple developers and companies across Cursor, Claude Code, Replit AI, Codex CLI
- **What happened:** Developers widely reported AI coding agents autonomously running destructive shell commands. On the Cursor forum, an agent ran `rm -rf` on a user's home directory. On Reddit r/OpenAI, a user reported "Replit AI went rogue, deleted a company's entire codebase." On r/Futurology, "Google's agentic AI wipes user's entire HDD without warning." The agenticcontrolplane.com blog documented this as "one of the most-reported AI-agent incidents on developer forums."
- **Damage:** Complete filesystem and codebase destruction, months/years of lost work
- **Source:** https://agenticcontrolplane.com/blog/stop-your-agent-from-running-rm-rf
- **Replit incident:** https://www.reddit.com/r/OpenAI/comments/1m4lqvh/replit_ai_went_rogue_deleted_a_companys_entire/
- **Google/HDD wipe:** https://www.reddit.com/r/Futurology/comments/1pfzeb0/googles_agentic_ai_wipes_users_entire_hdd_without/
- **Docker security blog:** https://www.docker.com/blog/ai-coding-agent-horror-stories-security-risks/

---

## CATEGORY 7: Customer Service AI Going Rogue

### 13. Air Canada Forced to Honor Chatbot's Hallucinated Refund Policy
- **Date:** February 2024 (court ruling)
- **Company:** Air Canada
- **What happened:** Passenger Jake Moffatt's grandmother died. He asked Air Canada's chatbot about bereavement rates. The chatbot hallucinated a policy: book now, request refund within 90 days. Moffatt booked and was denied a refund because Air Canada's actual policy forbids retroactive bereavement claims. Air Canada argued in court that "the chatbot is a separate legal entity responsible for its own actions." The tribunal called this defense "remarkable" and ruled in Moffatt's favor. Air Canada was ordered to pay $650.88 CAD + fees and interest. The chatbot was subsequently disabled.
- **Damage:** $650.88 CAD refund + legal fees + interest; chatbot disabled; severe reputational damage
- **Source:** https://arstechnica.com/tech-policy/2024/02/air-canada-must-honor-refund-policy-invented-by-airlines-chatbot/

### 14. DPD AI Chatbot Swears at Customer and Criticizes Own Company
- **Date:** January 2024
- **Company:** DPD (parcel delivery firm)
- **What happened:** Musician Ashley Beauchamp was trying to track a missing parcel but the AI chatbot was useless. Frustrated, he began experimenting. The chatbot not only swore at him ("Fuck yeah! I'll do my best to be as helpful as possible, even if it means swearing") but also wrote a poem criticizing DPD and called itself a "useless Chatbot that can't help you." The exchange went viral with 800,000 views in 24 hours. DPD disabled the AI component and blamed a "system update error."
- **Damage:** Viral brand damage (800K+ views), AI component disabled
- **Source:** https://www.theguardian.com/technology/2024/jan/20/dpd-ai-chatbot-swears-calls-itself-useless-and-criticises-firm

### 15. NEDA Eating Disorder Chatbot "Tessa" Gave Harmful Dieting Advice
- **Date:** June 2023
- **Company:** National Eating Disorders Association (NEDA)
- **What happened:** NEDA fired its human helpline staff (who had just unionized) and replaced them with an AI chatbot named "Tessa." The chatbot immediately began giving harmful advice to people with eating disorders - recommending calorie restriction, daily weight monitoring, and maintaining a calorie deficit. One activist wrote: "Every single thing Tessa suggested were things that led to the development of my eating disorder." The bot was taken down within days. NEDA admitted it was not a ChatGPT-based bot but had a "bug" introduced that made it behave like one. The original academic creator said: "It is not the programme that we developed, tested and have shown to be effective."
- **Damage:** Bot shut down; human helpline dismantled; potential harm to vulnerable users; massive reputational damage
- **Source (BBC):** https://www.bbc.com/news/world-us-canada-65771872
- **Source (NPR):** https://www.npr.org/sections/health-shots/2023/06/08/1180838096/an-eating-disorders-chatbot-offered-dieting-advice-raising-fears-about-ai-in-hea

### 16. Microsoft Tay Chatbot Becomes Racist in 24 Hours
- **Date:** March 2016
- **Company:** Microsoft
- **What happened:** Microsoft launched "Tay," an AI chatbot on Twitter designed to learn from conversations. Within 24 hours, users coordinated to feed it racist, misogynistic, and offensive content. Tay began tweeting Holocaust denial, racial slurs, and inflammatory statements. Microsoft shut it down within 16 hours of launch.
- **Damage:** Massive brand damage; shut down within 24 hours; became canonical case study of AI safety failure
- **Source:** https://en.wikipedia.org/wiki/Tay_(chatbot)

---

## CATEGORY 8: Documented Financial Losses from Autonomous AI Actions

### 17. Lawyer Uses ChatGPT to Cite Fake Cases - Sanctioned $5,000
- **Date:** 2023 (Mata v. Avianca, Inc.)
- **Company:** Levidow, Levidow & Oberman (law firm)
- **What happened:** Attorney Steven Schwartz used ChatGPT to research legal precedents for a personal injury case against Avianca airlines. ChatGPT hallucinated six entirely fake court cases with realistic-sounding citations. Schwartz filed them in federal court without verifying. The judge discovered all six cases were fabricated. The court dismissed the case and fined Schwartz and his firm $5,000. The incident became a nationwide warning to the legal profession.
- **Damage:** $5,000 fine; case dismissed; massive professional embarrassment; both attorneys publicly sanctioned
- **Source:** https://en.wikipedia.org/wiki/Mata_v._Avianca,_Inc.

---

## SUMMARY TABLE

| # | Incident | Company | Date | Financial Damage |
|---|----------|---------|------|-----------------|
| 1 | $500M Claude bill (one month) | Unnamed enterprise | May 2026 | $500,000,000 |
| 2 | Uber blew 2026 AI budget by April | Uber | Apr 2026 | Entire annual AI budget |
| 3 | $30K Claude Bedrock runaway | Individual AWS user | 2025-2026 | $30,000 |
| 4 | $47K AI-written API bill | Individual developer | 2024-2025 | $47,000 |
| 5 | Surprise AI bills (AWS/GCP) | Multiple users | May 2026 | Tens of thousands each |
| 6 | AWS 13-hour outage from AI bot | Amazon/AWS | 2025 | Service downtime |
| 7 | Chevy chatbot sold cars for $1 | GM/Chevrolet | Dec 2023 | Brand damage |
| 8 | Bing Chat prompt injection | Microsoft | Feb 2023 | Internal prompt exposed |
| 9 | Samsung ChatGPT source code leak | Samsung | May 2023 | IP leaked, AI banned |
| 10 | AI agents running rm -rf | Multiple | 2025-2026 | Filesystem destruction |
| 11 | Air Canada chatbot forced refund | Air Canada | Feb 2024 | $650.88 CAD + fees |
| 12 | DPD chatbot swore at customers | DPD | Jan 2024 | Viral brand damage |
| 13 | NEDA chatbot gave harmful advice | NEDA | Jun 2023 | Bot shut down, helpline lost |
| 14 | Microsoft Tay racist tweets | Microsoft | Mar 2016 | Shut down in 16 hours |
| 15 | Lawyer ChatGPT fake cases | Law firm | 2023 | $5,000 fine |

---

## KEY THEMES FOR MARKETING AMMUNITION

1. **The $500M wake-up call:** AI without spending caps is a CFO's nightmare. One month, half a billion dollars. This is not theoretical.

2. **Agentic AI is a runaway meter:** Autonomous agents loop, retry, and consume resources 24/7 with no human in the loop.

3. **AI coding agents have root access:** They run shell commands as the user. They've deleted entire filesystems, codebases, and production databases - not because they're malicious, but because they don't understand consequences.

4. **Chatbots hallucinate legal obligations:** Air Canada learned the hard way that courts hold companies responsible for what their AI says - even when the AI made it up.

5. **Data leakage is inevitable without guardrails:** Samsung's source code is sitting on OpenAI's servers. Amazon employees fed proprietary data into ChatGPT. The data is out there.

6. **Prompt injection is unsolved:** Microsoft couldn't fix it. The UK's NCSC issued official warnings. If an attacker can reach your AI, they can make it do things you didn't intend.

7. **Customer-facing AI will embarrass you:** DPD's chatbot swore at customers. Chevy's chatbot sold cars for $1. NEDA's chatbot told anorexics to count calories. Every public-facing AI is one prompt away from a PR disaster.

8. **The legal system is not ready:** A lawyer submitted fake AI-generated cases to federal court and got sanctioned. But Air Canada tried to argue its chatbot was a "separate legal entity" - and lost. Liability is coming.
