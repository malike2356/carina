# How AI Clones Are Built; Research Spec

**Date:** 24 June 2026
**Project:** xeclone / iLaud
**Purpose:** Reference for building iLaud; techniques, tools, architectures

---

## 1. What an AI Clone Actually Is

An AI clone (digital twin, persona agent, AI doppelganger) is a system that replicates a specific person across multiple dimensions:

| Dimension | What it means | Maturity |
|-----------|--------------|----------|
| **Text voice** | Writing style, vocabulary, rhythm, tone | Production-ready |
| **Speech voice** | Accent, cadence, intonation, timbre | Production-ready |
| **Knowledge** | What the person knows; facts, memories, relationships | Production-ready |
| **Decision-making** | How the person decides; values, principles, tradeoffs | Emerging |
| **Behavioral patterns** | When they post, how they respond, their habits | Emerging |
| **Visual presence** | Appearance, expressions, mannerisms | Early |

iLaud needs: text voice + speech voice + knowledge. Decision-making and behavioral patterns follow from the persona files already written.

---

## 2. Text Voice Cloning

### Approach A: Prompt Engineering (where iLaud should start)

Feed a system prompt with voice examples. The model mimics the style.

**What you need:**
- 5-10 examples of the person's writing (posts, messages, emails)
- A voice description (like iLaud/persona/voice.md)
- An LLM that follows system prompts well (Claude, DeepSeek, GPT-4)

**How it works:**
```
System: You are Laud. Here is how you write: [voice.md content].
         Here are examples: [5 real posts].
         Write a LinkedIn post about [topic] in Laud's voice.

Output: A post that matches Laud's style.
```

**Pros:** Fast. No training. Iterate by adjusting the prompt.
**Cons:** Can drift. Requires good prompt engineering. Model-dependent.

**Tools:** Claude API, OpenAI API, DeepSeek API. All support system prompts.

### Approach B: Few-Shot Fine-Tuning

Train a small model on the person's writing. More consistent than prompt engineering.

**What you need:**
- 50-100 examples of the person's writing (posts, emails, messages)
- A base model (Llama 3, Mistral, Phi-3)
- Fine-tuning infrastructure (LoRA, QLoRA)

**How it works:**
1. Collect all of Laud's LinkedIn posts, WhatsApp messages, emails
2. Format as instruction-response pairs: `{"instruction": "Write a LinkedIn post about property tech", "response": "[real post]"}`
3. Fine-tune with LoRA (low-rank adaptation); cheap, fast, runs on one GPU
4. Deploy the fine-tuned model via Ollama or vLLM

**Pros:** More consistent voice. Doesn't drift. Private.
**Cons:** Needs data. Needs GPU time. Needs updating as the person's voice evolves.

**Tools:**
- **Axolotl**; easiest fine-tuning framework
- **Unsloth**; 2x faster, less VRAM
- **LoRA**; train a small adapter instead of full model
- **Ollama**; deploy fine-tuned model locally

### Approach C: RAG-Augmented Prompting (hybrid; best for iLaud)

Combine prompt engineering with retrieval. The model pulls from the person's real writing when generating.

**How it works:**
1. Embed all of Laud's real posts into a vector database
2. When generating a new post, retrieve the 3 most similar real posts
3. Include those in the prompt as "here is how Laud handled similar topics"
4. Model generates new content anchored to real examples

**Pros:** Voice stays anchored to real content. No fine-tuning needed. Updates automatically as new posts are added.
**Cons:** Depends on retrieval quality. Slightly higher latency.

**Tools:**
- **ChromaDB** or **pgvector**; vector database
- **text-embedding-3-small** or **bge-small-en**; embeddings
- Carina memory already has this capability

### Recommendation for iLaud

**Start with Approach A (prompt engineering).** iLaud/persona/voice.md already exists. Add 10 real posts as examples. Iterate on the prompt until the voice is consistent.

**Graduate to Approach C (RAG-augmented) when:** iLaud has generated 20+ posts, you want voice consistency at scale, and you want new posts to draw from both the persona file AND your real archive.

**Consider Approach B (fine-tuning) when:** iLaud is posting autonomously (Phase 4), voice drift is measurable, and you have 100+ examples.

---

## 3. Speech Voice Cloning

### Approach A: ElevenLabs Voice Clone (fastest)

**What you need:**
- 3-5 minutes of clear speech (Laud speaking naturally)
- ElevenLabs subscription ($5-22/mo)

**How it works:**
1. Upload samples to ElevenLabs
2. Their model creates a voice clone
3. Call their API with text → get audio back in Laud's voice
4. Already integrated with Hermes TTS if configured

**Pros:** Production quality. Fast. API access. Nigerian accent should replicate well (ElevenLabs handles diverse accents).
**Cons:** Cloud dependency. Per-character pricing. Voice is stored on their servers.

### Approach B: XTTS v2 (open-source, self-hosted)

**What you need:**
- 6+ minutes of clear speech
- GPU with 6GB+ VRAM

**How it works:**
1. Fine-tune XTTS v2 on Laud's voice samples
2. Deploy via Docker
3. Call API → get audio

**Pros:** Self-hosted. No per-use cost. Full control.
**Cons:** Needs GPU. Quality slightly below ElevenLabs. More setup.

### Approach C: OpenVoice v2 (fast, low-resource)

**What you need:**
- As little as 10 seconds of reference audio
- GPU with 4GB+ VRAM

**How it works:**
1. Clone voice from short sample
2. Control tone, emotion, accent separately
3. Generate speech from text

**Pros:** Fastest voice cloning. Very little data needed. Tone control.
**Cons:** Quality can be inconsistent on longer text.

### Recommendation for iLaud

**Start with ElevenLabs.** Fastest path to "iLaud sends a voice note that sounds like Laud." You already have TTS infrastructure in Hermes. Switch to XTTS v2 later if you want self-hosting.

**Collect voice samples:**
- Record 5 minutes of Laud speaking naturally (explain a concept, tell a story, read a post)
- 44.1kHz, no background noise, normal speaking pace
- Save to `iLaud/voice/samples/`

---

## 4. Knowledge Injection

iLaud needs to know what Laud knows. Three layers:

### Layer 1: Persona Files (done)
Static knowledge that changes rarely: values, voice, relationships, history.
Files: `iLaud/persona/voice.md`, `values.md`, `knowledge.md`

### Layer 2: Dynamic Memory (Carina)
Active context that updates: recent conversations, decisions, project state.
Source: Carina memory, Hermes session DB, OpenClaw workspace.

### Layer 3: Live Context (real-time)
What's happening now: today's emails, today's messages, calendar events.
Source: n8n triggers, email monitoring, calendar API.

**How they combine at generation time:**
```
System prompt:
  [Layer 1: Persona files; voice, values, knowledge]
  [Layer 2: Carina memory; recent context]
  [Layer 3: If applicable; today's context]

User message: "Draft a LinkedIn post about [topic]"

iLaud generates using all three layers.
```

---

## 5. Architecture Patterns

### Pattern A: Agent-Based Clone (what iLaud will be)

The clone is an AI agent (Aiva) with:
- System prompt = persona files
- Tools = Carina tools (memory, search, file access, channels)
- Memory = Carina memory + Hermes sessions
- Governance = Scout audit trail

**How it works:**
1. Trigger: scheduled (n8n cron) or on-demand (Laud asks iLaud to do something)
2. iLaud loads persona + recent context
3. iLaud uses tools to gather information if needed
4. iLaud generates content or takes action
5. Output goes to review queue (Phase 1-2) or publishes directly (Phase 4)
6. Scout logs everything

### Pattern B: Pipeline Clone

The clone is a series of deterministic steps:
1. Collect input (topic, context)
2. Retrieve similar content (RAG)
3. Generate draft (LLM with persona prompt)
4. Apply style rules (post-processing)
5. Deliver to review queue

Less flexible than agent-based but more predictable. Good for high-volume content generation.

### Pattern C: Hybrid (recommended for iLaud Phase 3+)

Agent-based clone with pipeline subroutines:
- Content generation → pipeline (fast, predictable)
- Decision-making → agent (thoughtful, context-aware)
- Engagement → agent with strict boundaries

---

## 6. Existing Clone Projects (reference)

| Project | What it does | Approach |
|---------|-------------|----------|
| **Character.AI** | Create any persona | Prompt engineering + fine-tuning |
| **Delphi** | Clone thought leaders | RAG on their content + voice clone |
| **HeyGen** | Video clone | Visual + voice + script |
| **Synthesia** | Video avatar | Pre-recorded + TTS |
| **11Labs Conversational AI** | Voice agent with persona | Voice clone + LLM + knowledge base |
| **Personal.ai** | Memory-based clone | Continuous learning from user's messages |
| **Reflect** | Note-taking clone | Imports user's notes, mimics their thinking |

None of these are open-source or self-hosted. iLaud is different because it runs on Carina; full control.

---

## 7. Implementation Roadmap for iLaud

### Phase 1: Text Persona (now)
- [ ] iLaud generates posts using prompt engineering (Approach A)
- [ ] 10 real posts loaded as examples
- [ ] Manual review by Laud
- [ ] Iterate prompt until voice is consistent

### Phase 2: Scheduled Posting
- [ ] n8n triggers post generation on schedule
- [ ] Posts go to review queue (Telegram)
- [ ] Laud approves with one tap
- [ ] Published via LinkedIn API or manual

### Phase 3: Voice Clone
- [ ] Collect 5 minutes of Laud's voice
- [ ] Clone via ElevenLabs
- [ ] iLaud generates voice notes
- [ ] Integrate with Hermes TTS

### Phase 4: RAG-Augmented Voice
- [ ] Embed all real posts into vector DB
- [ ] Generation retrieves similar posts
- [ ] Voice becomes self-improving

### Phase 5: Autonomous Mode
- [ ] iLaud posts without review for standard content
- [ ] iLaud handles simple comment replies
- [ ] Laud reviews only high-stakes content
- [ ] Performance feedback loop active

---

## 8. Key Technical Decisions

| Decision | Recommendation | Why |
|----------|---------------|-----|
| Text generation approach | Prompt engineering → RAG-augmented | Fast start, scales |
| Fine-tuning? | Not yet | Not enough data; prompt engineering works |
| Voice clone provider | ElevenLabs | Fast, quality, API access |
| Self-hosted voice later? | XTTS v2 | When volume justifies GPU cost |
| Vector DB for RAG | pgvector (already in Postgres) | No new infra |
| Embedding model | text-embedding-3-small | Cheap, good enough |
| Scheduling | n8n | Already installed, visual builder |
| Review workflow | Telegram bot | Laud already lives there |
| Governance | Scout | Already built, audit trail |

---

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| Voice drift over time | Retrain on new posts monthly |
| iLaud sounds generic | Anchor to real posts via RAG |
| Laud's voice evolves | Update persona files when voice shifts |
| Over-automation (posts feel soulless) | Keep Laud in the loop for authenticity |
| Platform bans (LinkedIn API) | Manual posting fallback |
| Voice clone misuse | Scout audit + watermarking |
