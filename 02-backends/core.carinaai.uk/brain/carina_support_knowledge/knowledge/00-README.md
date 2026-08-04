# Carina Support Knowledge Pack

User-facing knowledge base for the Carina AI and Labyrinth Scout support agent.

The Support profile loads `../system-prompt.md`, which embeds this knowledge directly in the system prompt (direct injection, not RAG).

To update knowledge: edit the numbered files in this directory, regenerate `system-prompt.md` from the support-agent prompt pack, and redeploy or refresh the Support profile seed.

Pack name: `carina_support_knowledge`
