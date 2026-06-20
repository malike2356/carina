# Carina Onboarding & Aesthetics; Gold Standard Upgrade

> **REUSE RULE:** See `../REUSE-RULES.md`. This document benchmarks behavior against competitor agents. The implementation must match the quality and capability described, but use Carina's own voice, naming, and presentation throughout.


**Date:** 2026-06-17
**Purpose:** Make Carina's first-launch, onboarding, and aesthetic experience the gold standard; the agent people admire and desire
**Reference agents:** Hermes (warmth + personality), OpenClaw (professionalism + polish), Odysseus (beauty + minimalism)
**Target:** Carina must be the product people screenshot, share, and aspire to

---

## DESIGN PHILOSOPHY

### The Three Pillars

```
HERMES    → Personality. The agent should feel alive. Spinner faces, themed
            verbs, a voice. You should smile when you open it.

OPENCLAW  → Professionalism. Every interaction should feel intentional.
            Consistent, international, self-healing. You should trust it.

ODYSSEUS  → Beauty. Dark theme perfection. Generous whitespace. Fira Code
            on everything. Transitions that feel like butter. You should
            want to screenshot it.
```

### The Carina Synthesis

```
Carina = Hermes' soul + OpenClaw' bones + Odysseus' skin + Carina's brain
```

---

## PART 1; TERMINAL ONBOARDING (CLI + TUI)

### 1.1 The First-Run Moment

When a user runs `carina` for the first time, they should feel WELCOMED, not interrogated. Adopt Hermes' warmth with OpenClaw's thoroughness.

**Current Carina:** Detects first run → runs onboarding → boots provider → shows banner. Functional. No emotion.

**Target Carina:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      W E L C O M E                        │
│                                                             │
│              ⠀⠀⠀⣠⣶⣿⣿⣿⣿⣶⣄⠀⠀⠀                                │
│              ⠀⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀                                │
│              ⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀                                │
│              ⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆                                │
│              ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿                                │
│              ⠸⣿⣿⣿⣿⣿⠋⠙⣿⣿⣿⣿⡇                                │
│              ⠀⠻⣿⣿⣿⣷⣤⣤⣾⣿⣿⣿⠟⠀                                │
│                                                             │
│                    C A R I N A                              │
│              Your AI workspace. Beautiful.                   │
│                                                             │
│         "The agent that makes other agents jealous."         │
│                                                             │
│                    Let's get you set up.                     │
│                    It takes about 90 seconds.                │
│                                                             │
│                    [ Press Enter to begin ]                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 The Setup Flow (Warm + Thorough)

Adopt Hermes' personality with OpenClaw's depth. Each step has:
- A clear question
- A sensible default
- A skip option
- A subtle animation/progress indicator
- Personality in the helper text

```
Step 1/6; What should I call you?

  This is your workspace name. You can change it later.
  Think of it as naming your ship. 

  Workspace name [My Workspace]: _

  ─────────────────────────────────────────────
  Progress: █░░░░░░░░░ 1/6


Step 2/6; Choose your AI engine.

  I can run on different AI providers. Pick one to start.
  (Don't worry; you can add more later, and I'll
  automatically fall back if one goes down.)

   OpenAI (GPT-5, GPT-5.5); Best overall
    Anthropic (Claude Sonnet 4); Best for coding
    DeepSeek (v4); Best value
    Google (Gemini 3); Best for vision
    GitHub Copilot (Free); Free tier
    Bring your own key; Any OpenAI-compatible API

  ─────────────────────────────────────────────
  Progress: ██░░░░░░░░ 2/6


Step 3/6; API key for OpenAI.

  Your key is stored encrypted on your machine.
  I never send it anywhere except to OpenAI.
  (You can also set this later via CARINA_OPENAI_KEY env var.)

  API key: ••••••••••••••••••••••••••••••••   Verified

  ─────────────────────────────────────────────
  Progress: ███░░░░░░░ 3/6


Step 4/6; Where should I live?

  I need a home directory for my brain, skills,
  and memories. The default is fine for most people.

  Carina home [/home/laud/.carina]: _

  ─────────────────────────────────────────────
  Progress: ████░░░░░░ 4/6


Step 5/6; How should I talk?

  Every agent has a voice. Pick a starting personality.
  You can customize this anytime.

   Direct & concise; "Just the facts. No fluff."
    Warm & playful; "Friendly coworker who knows everything."
    Technical expert; "Precise. Thorough. Code-first."
    Custom; "Write your own SOUL.md"

  Preview: "Hey! I'm Carina. I'll be direct, skip the
  pleasantries, and get straight to what matters.
  Sound good?"

  ─────────────────────────────────────────────
  Progress: █████░░░░░ 5/6


Step 6/6; Almost done! Want the full tour?

   Yes; Show me everything (2 min quickstart)
    No; Take me straight to chat
    Later; Remind me next time

  ─────────────────────────────────────────────
  Progress: ██████░░░░ 6/6


 All set! Your workspace is ready.

  Type /help anytime to see what I can do.
  Type carina tui for the full terminal experience.
  Type carina tui --operator to manage everything.

  Welcome to the family, Laud. Let's build something great. 
```

### 1.3 The Quickstart Tour (Optional Step 6)

If user chooses "Yes; Show me everything":

```
┌─ QUICKSTART TOUR ──────────────────────────────────────────┐
│                                                             │
│  Here's what you can do with Carina:                        │
│                                                             │
│    Chat                  carina                           │
│      Start a conversation. I can code, research, create,    │
│      analyze, and more.                                     │
│                                                             │
│    Terminal UI           carina tui                       │
│      Full terminal experience with streaming, tools,        │
│      model switching.                                       │
│                                                             │
│    Operator Dashboard    carina tui --operator            │
│      Manage sessions, agents, tasks, logs, Scout.           │
│                                                             │
│    Web Dashboard         carina gateway start             │
│      Open http://localhost:8080 for the full web UI.        │
│                                                             │
│    Mobile                carina gateway start             │
│      Pair your phone at Settings → Pairing.                 │
│                                                             │
│    Scout (add-on)        carina scout status              │
│      AI security monitoring. Upgrade at carinaai.uk.        │
│                                                             │
│  ⏰  Cron Jobs              carina cron create "..."         │
│      Schedule recurring tasks. Morning briefings,           │
│      daily reports, reminders.                              │
│                                                             │
│    Skills                 carina hub search <topic>       │
│      Install skills from the community or create your own.  │
│                                                             │
│    Doctor                 carina doctor                   │
│      Diagnose and repair issues automatically.              │
│                                                             │
│  Press Enter to start chatting, or /help anytime.           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 The Banner (Every Launch After First Run)

Adopt Hermes' skin engine with Odysseus' beauty:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     C A R I N A                      v2.0 · gold-standard │
│                                                             │
│   Workspace   My Workspace                                  │
│   Model       Claude Sonnet 4    ·  200K context            │
│   Provider    Anthropic          ·  $3/$15 per 1M tokens    │
│   Profile     default            ·  Direct & concise        │
│   Scout        Shield Active   ·  Trust 87/100            │
│   Tools       83 available       ·  /help to see all        │
│                                                             │
│   Type a message, or /help for commands.                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 The Theme Engine (from Hermes)

```typescript
// src/cli/theme/
├── engine.ts; theme loader and applicator
├── presets/
│   ├── default.ts; Carina dark (default)
│   ├── light.ts; Carina light
│   ├── scout.ts; Scout red/black
│   ├── cyberpunk.ts; Neon on black
│   ├── monochrome.ts; Grayscale
│   ├── forest.ts; Green on dark
│   └── ocean.ts; Blue on dark
├── faces.ts; Spinner face sets
│   ├── kawaii; (◕‿◕) (◠‿◠) (◡‿◡)
│   ├── minimal; ◷ ◶ ◵ ◴
│   ├── moon; 
│   ├── cat; 
│   └── dots; ⠋ ⠙ ⠹ ⠸ ⠼
├── verbs.ts; Action verb sets
│   ├── default; thinking, working, creating
│   ├── playful; cooking, brewing, conjuring
│   ├── scout; scanning, patrolling, guarding
│   └── minimal; processing
└── branding.ts; Logo variants (ASCII art sets)
```

**Theme configuration:**
```yaml
# ~/.carina/config.yaml
display:
  theme: default
  skin: default
  spinner: kawaii
  verbs: default
  showScoutStatus: true
  showTokenCount: true
  bannerStyle: full        # full | compact | minimal
```

**Spinner example in action:**
```
⏳ Conjuring a response...     (using playful verb set)
 Patrolling for threats...   (using scout verb set)  
 Thinking...                 (using default verb set)
```

---

## PART 2; GUI / WEB ONBOARDING

### 2.1 The Landing Page (First Visit)

Before login, the landing page must sell the dream:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                      C A R I N A                         │
│                                                            │
│            Your AI workspace. Beautiful.                    │
│                                                            │
│     ┌──────────────────────────────────────────┐           │
│     │    "Carina, draft my investor update"   │           │
│     │                                          │           │
│     │  Here's your draft:                       │           │
│     │  ┌──────────────────────────────────┐    │           │
│     │  │ # June 2026 Investor Update      │    │           │
│     │  │                                  │    │           │
│     │  │ ## Key Metrics                   │    │           │
│     │  │ • Revenue: $12,450 (+23% MoM)   │    │           │
│     │  │ • Users: 847 (+18%)             │    │           │
│     │  │ • Churn: 2.1% (-0.3%)           │    │           │
│     │  │                                  │    │           │
│     │  │ ## Product Updates               │    │           │
│     │  │ • Launched Scout v2              │    │           │
│     │  │ • Mobile app in beta             │    │           │
│     │  └──────────────────────────────────┘    │           │
│     │                                          │           │
│     │  Want me to send this via email?         │           │
│     └──────────────────────────────────────────┘           │
│                                                            │
│     [ Start Free ]    [ Self-Host ]    [ Enterprise ]      │
│                                                            │
│     No credit card required. 14-day free trial.            │
│     Cancel anytime. Your data stays yours.                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2.2 The Registration Flow

Minimal friction. Adopt Odysseus' single-form beauty:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              Create your workspace                          │
│                                                            │
│     ┌──────────────────────────────────────────┐           │
│     │  Email                                   │           │
│     │  laud@example.com                        │           │
│     │                                          │           │
│     │  Workspace name                          │           │
│     │  Laud's Workspace                        │           │
│     │                                          │           │
│     │  Password                                │           │
│     │  ••••••••••••                            │           │
│     │                                          │           │
│     │  [ Create workspace ]                    │           │
│     │                                          │           │
│     │  Already have an account? Sign in →      │           │
│     └──────────────────────────────────────────┘           │
│                                                            │
│     By creating an account you agree to our                │
│     Terms of Service and Privacy Policy.                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2.3 The Dashboard First Visit (Empty State)

First time after login; not an empty void, but a guided welcome:

```
┌────────────────────────────────────────────────────────────┐
│    Dashboard    Chat    Research    Library    Settings   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                Welcome to your workspace, Laud            │
│                                                            │
│   ┌─────────────────────┐  ┌─────────────────────┐        │
│   │                     │  │                     │        │
│   │     Start Chat    │  │     Configure AI  │        │
│   │                     │  │                     │        │
│   │   Begin your first  │  │   Choose your model │        │
│   │   conversation      │  │   and provider      │        │
│   │   with Carina       │  │                     │        │
│   │                     │  │                     │        │
│   │   [ Open Chat ]     │  │   [ Configure ]     │        │
│   │                     │  │                     │        │
│   └─────────────────────┘  └─────────────────────┘        │
│                                                            │
│   ┌─────────────────────┐  ┌─────────────────────┐        │
│   │                     │  │                     │        │
│   │     Get Mobile    │  │     Add Scout      │        │
│   │                     │  │                     │        │
│   │   Install Carina    │  │   AI security        │        │
│   │   on your phone     │  │   monitoring         │        │
│   │                     │  │                     │        │
│   │   [ Pair Device ]   │  │   [ Learn More ]     │        │
│   │                     │  │                     │        │
│   └─────────────────────┘  └─────────────────────┘        │
│                                                            │
│   ┌──────────────────────────────────────────────────┐     │
│   │   Quick tip: Type /help in chat to see all      │     │
│   │  commands. Press Cmd+K to search anything.        │     │
│   └──────────────────────────────────────────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2.4 The Empty States (Every Surface)

Every page that has no data yet should show a beautiful empty state, not a blank page:

```
Chat (no sessions):
  ┌──────────────────────────────────────┐
  │                                      │
  │                                    │
  │                                      │
  │     Start your first conversation    │
  │                                      │
  │     Carina can help you code,        │
  │     write, research, analyze,        │
  │     and so much more.                │
  │                                      │
  │     ┌────────────────────────────┐   │
  │     │  "Explain quantum computing│   │
  │     │   like I'm five"           │   │
  │     └────────────────────────────┘   │
  │     ┌────────────────────────────┐   │
  │     │  "Write a Python script to │   │
  │     │   sort my downloads folder"│   │
  │     └────────────────────────────┘   │
  │     ┌────────────────────────────┐   │
  │     │  "Research the best ORMs   │   │
  │     │   for PostgreSQL in 2026"  │   │
  │     └────────────────────────────┘   │
  │                                      │
  │     Or type your own message below.  │
  │                                      │
  └──────────────────────────────────────┘

Documents (no documents):
  ┌──────────────────────────────────────┐
  │                                      │
  │                                    │
  │                                      │
  │     No documents yet                 │
  │                                      │
  │     Carina can create documents      │
  │     for you. Just ask in chat:       │
  │                                      │
  │     "Create a document with my       │
  │      weekly goals"                   │
  │                                      │
  │     Or upload one:                   │
  │     [ Upload document ]              │
  │                                      │
  └──────────────────────────────────────┘

Skills (no skills):
  ┌──────────────────────────────────────┐
  │                                      │
  │                                    │
  │                                      │
  │     No skills installed yet          │
  │                                      │
  │     Skills are reusable workflows    │
  │     that make Carina smarter.        │
  │                                      │
  │     ┌────────────────────────────┐   │
  │     │  Browse the Hub →          │   │
  │     └────────────────────────────┘   │
  │     ┌────────────────────────────┐   │
  │     │  Create your own skill →   │   │
  │     └────────────────────────────┘   │
  │                                      │
  └──────────────────────────────────────┘

Scout (no access):
  ┌──────────────────────────────────────┐
  │                                      │
  │                                    │
  │                                      │
  │     Scout is not active              │
  │                                      │
  │     Scout monitors your AI agents    │
  │     for security threats in real     │
  │     time.                            │
  │                                      │
  │     • Detect prompt injection        │
  │     • Block malicious tool calls     │
  │     • Trust scoring per agent        │
  │     • Kill switch for emergencies    │
  │                                      │
  │     ┌────────────────────────────┐   │
  │     │  Enable Scout →             │   │
  │     │  From £19/month             │   │
  │     └────────────────────────────┘   │
  │                                      │
  └──────────────────────────────────────┘
```

---

## PART 3; THE AESTHETIC SYSTEM

### 3.1 Dark Theme (from Odysseus)

Odysseus has the best dark theme of any agent. Adopt its palette:

```css
:root {
  /* Odysseus-inspired dark palette */
  --bg-primary: #0d1117; /* Deepest background */
  --bg-secondary: #161b22; /* Card/surface background */
  --bg-tertiary: #21262d; /* Hover/active states */
  --bg-input: #0d1117; /* Input backgrounds */
  
  --border-primary: #30363d; /* Primary borders */
  --border-secondary: #21262d; /* Subtle borders */
  
  --text-primary: #e6edf3; /* Primary text */
  --text-secondary: #8b949e; /* Secondary/muted text */
  --text-tertiary: #6e7681; /* Tertiary/dim text */
  
  --accent-blue: #58a6ff; /* Links, primary actions */
  --accent-green: #3fb950; /* Success, positive */
  --accent-red: #f85149; /* Danger, errors */
  --accent-orange: #d2991d; /* Warnings */
  --accent-purple: #a371f7; /* Special/featured */
  
  /* Spacing; generous, Odysseus-style */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  
  /* Typography */
  --font-mono: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
  
  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

### 3.2 Fira Code Everywhere

Odysseus uses Fira Code. Carina should too. Bundle it:

```css
@font-face {
  font-family: 'Fira Code';
  src: url('/fonts/FiraCode-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Fira Code';
  src: url('/fonts/FiraCode-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
}
@font-face {
  font-family: 'Fira Code';
  src: url('/fonts/FiraCode-Light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
}

/* Ligatures enabled for code */
code, pre, .font-mono {
  font-family: 'Fira Code', var(--font-mono);
  font-feature-settings: 'calt' 1, 'ss01' 1, 'ss02' 1, 'ss03' 1;
}
```

### 3.3 Smooth Page Transitions

Every navigation should feel fluid:

```css
/* Page transitions */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms ease, transform 200ms ease;
}

/* Sidebar transitions */
.sidebar-enter {
  transform: translateX(-100%);
}
.sidebar-enter-active {
  transform: translateX(0);
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Modal transitions */
.modal-overlay-enter {
  opacity: 0;
}
.modal-overlay-enter-active {
  opacity: 1;
  transition: opacity 200ms ease;
}
.modal-content-enter {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
.modal-content-enter-active {
  opacity: 1;
  transform: scale(1) translateY(0);
  transition: opacity 200ms ease, transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover transitions; everything feels alive */
a, button, .interactive {
  transition: color 150ms ease, background-color 150ms ease, 
              border-color 150ms ease, opacity 150ms ease,
              transform 150ms ease;
}
```

### 3.4 Micro-interactions

Small details that make Carina feel alive:

```
Hover on card:        subtle lift (translateY(-2px)) + shadow increase
Click button:         brief scale-down (scale(0.97)) then back
Toggle switch:        smooth slide with color transition
Menu open:            fade + slide from origin
Notification:         slide in from right, auto-dismiss with fade
Loading skeleton:     shimmer animation
Copy button:          brief "Copied!" tooltip that fades
Send message:         composer clears with subtle animation
Streaming response:   cursor blink, characters appear one by one
Tool call:            collapsible with smooth height transition
Scroll to bottom:     smooth scroll behavior
```

### 3.5 The Loading Experience

No spinners of death. Every loading state should be beautiful:

```
// Skeleton loading; content-shaped placeholders with shimmer
┌────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└────────────────────────────────────────────┘
  ↑ shimmer animation sweeps across

// Chat loading; Carina "thinking" with personality:
 Thinking...
 Consulting my notes...
 Almost there...

// Progress; for long operations:
Installing skill "deploy-to-vercel"...
[████████████░░░░░░░░] 68% · 3.2 MB/s · 4s remaining
```

---

## PART 4; MICRO-COPY & VOICE

### 4.1 Error Messages That Don't Feel Like Errors

```
Instead of:                    Write:
────────────────────────────────────────────────────────
"Error: Invalid API key"       "Hmm, that API key didn't work. 
                                Double-check it? You can find 
                                yours at platform.openai.com/keys"

"Connection refused"           "I can't reach the server right now.
                                Want me to keep trying, or should
                                we troubleshoot?"

"File not found"               "I looked everywhere but couldn't 
                                find that file. Here are the files 
                                I can see: ..."

"Permission denied"            "I don't have permission to do that.
                                You can grant access in Settings → 
                                Permissions."

"Rate limited"                 "Whoa, slow down! We've hit the rate
                                limit. I'll be ready in about 30
                                seconds. Want to queue this request?"
```

### 4.2 Success Messages That Feel Rewarding

```
Instead of:                    Write:
────────────────────────────────────────────────────────
"Skill installed"              " 'deploy-to-vercel' is ready! 
                                Try /skill deploy-to-vercel to use it."

"Backup created"               " Safe and sound. Backup saved as 
                                carina-2026-06-17.tar.gz (142 MB)"

"Model switched"               " Now using Claude Sonnet 4. 
                                200K context · $3/$15 per 1M tokens"

"Session cleared"              " Fresh start! New session created. 
                                Your old conversation is saved if you 
                                need it."
```

### 4.3 Empty States That Inspire Action

Every empty state should:
1. Acknowledge the emptiness ("Nothing here yet")
2. Explain what could be here ("This is where your X will appear")
3. Offer a clear action ("Create your first X")
4. Be beautiful (icon, spacing, muted colors)

### 4.4 The Carina Voice

Define a consistent voice for all Carina copy:

```
Tone:       Warm, competent, slightly playful. Not corporate.
            Not trying too hard to be funny. Just... good.

Principles:
  - Skip "please" and "thank you"; be direct
  - No exclamation marks unless genuinely exciting
  - Use emoji sparingly, as seasoning not main course
  - Never say "Great question!" or "I'd be happy to help!"
  - Call out problems early: "This will break your database"
    not "I have some concerns about the approach"
  - Admit uncertainty: "I'm not sure about that. Let me check."
    not "I don't have enough information to answer that."
```

---

## PART 5; INTERNATIONALIZATION (from OpenClaw)

Carina's UI should speak 12 languages. Every onboarding screen, every empty state, every error message.

### Priority languages:
```
1. English     (en); base
2. Spanish     (es); 500M+ speakers
3. French      (fr); 300M+ speakers
4. German      (de); 130M+ speakers
5. Japanese    (ja); 125M speakers
6. Korean      (ko); 80M speakers
7. Chinese     (zh); 1.3B speakers
8. Portuguese  (pt); 260M speakers
9. Arabic      (ar); 400M speakers (RTL)
10. Italian    (it); 85M speakers
11. Dutch      (nl); 25M speakers
12. Polish     (pl); 40M speakers
```

Adopt OpenClaw's i18n pattern from `webui-upgrade/03-openclaw-i18n.md`. Language detection: automatic from browser, overridable in settings.

---

## PART 6; PWA INSTALL (from Odysseus)

Odysseus is installable as a PWA. Carina should be too.

### Install Prompt

After 30 seconds on the dashboard, show a subtle prompt:

```
┌──────────────────────────────────────────┐
│    Install Carina for quick access     │
│                                          │
│  Get the app-like experience with        │
│  offline support and native feel.        │
│                                          │
│  [ Install ]    [ Not now ]              │
└──────────────────────────────────────────┘
```

Adopt full PWA spec from `webui-upgrade/06-odysseus-pwa.md`.

---

## PART 7; IMPLEMENTATION PLAN

### Phase 1; Foundation (Weeks 1-2)
```
- Implement Odysseus dark theme palette (CSS variables)
- Bundle Fira Code font
- Apply theme to all existing pages
- Create base empty state components
- Create base loading skeleton components
- Implement smooth page transitions
```

### Phase 2; Terminal Onboarding (Weeks 3-4)
```
- Build the 6-step first-run wizard with personality
- Implement progress bar and spinner animations
- Build the quickstart tour flow
- Implement theme engine with presets
- Implement spinner faces and verb sets
- Build the enhanced launch banner
```

### Phase 3; GUI Onboarding (Weeks 5-6)
```
- Redesign landing page (pre-login)
- Redesign registration flow (single form, beautiful)
- Build dashboard first-visit guided welcome
- Create empty states for all 15+ surfaces
- Implement PWA install prompt
```

### Phase 4; Micro-interactions (Weeks 7-8)
```
- Card hover lift effects
- Button click scale animations
- Toggle switch transitions
- Menu open/close animations
- Modal enter/exit transitions
- Notification slide-in
- Copy feedback tooltips
- Loading shimmer effect
- Chat message appear animation
- Tool call expand/collapse smooth height
- Smooth scroll to bottom
```

### Phase 5; Micro-copy & i18n (Weeks 9-10)
```
- Rewrite all error messages in Carina voice
- Rewrite all success messages in Carina voice
- Rewrite all empty states in Carina voice
- Create i18n key structure
- Translate to 3 priority languages (es, fr, de)
- Implement language detection
- Add language switcher to settings
```

### Phase 6; Polish (Weeks 11-12)
```
- Translate remaining 9 languages
- RTL support for Arabic
- Accessibility audit (keyboard navigation, screen readers)
- Performance audit (lighthouse 95+)
- Cross-browser testing
- Mobile responsiveness audit
- Final design review
```

---

## BEFORE/AFTER EXAMPLES

### Login Page

**Before (current Carina):**
```
Clean form. Works. Utilitarian.
```

**After (gold standard):**
```
Deep dark background. Centered card with generous padding.
"Carina" in Fira Code at the top. Subtle gradient on the
card border. Placeholder text that feels like a person wrote
it. "Sign in to your workspace" not "Authentication required."
Smooth fade-in on load. Input focus has a subtle blue glow.
Button has a gentle hover lift. "Create workspace" link
understated but clear. Dark theme perfection.
```

### Chat Interface

**Before:**
```
Functional chat. Messages appear. Composer at bottom.
Sidebar with navigation. Works.
```

**After:**
```
Deep background. Messages have subtle cards with role-colored
left borders (blue for user, green for Carina). Streaming
text appears with a gentle cursor blink. Tool calls expand
with smooth height transition. Model badge in top-right.
Keyboard shortcut hints appear on hover. Empty state: 
beautiful prompt suggestions. Composer has subtle focus glow.
Send button animates on click. Everything feels alive.
```

### Error State

**Before:**
```
Red text: "Error: Connection refused"
```

**After:**
```
Card with amber left border. Icon: . Heading: "Can't reach
the server." Body: "I'll keep trying in the background. In the
meantime, you can: [Check your connection] [Try a different
server] [Run diagnostics]." Retry button with subtle pulse
animation. Error ID for support. Timestamp. Not scary. Helpful.
```

---

## THE MOMENT OF DELIGHT

The goal is that when someone opens Carina for the first time, they:
1. **Smile** at the welcome banner (personality from Hermes)
2. **Trust** the setup flow (professionalism from OpenClaw)
3. **Screenshot** the interface (beauty from Odysseus)
4. **Tell someone** about it

That's the gold standard. That's what we're building.

---

## REFERENCE FILES

```
Odysseus (beauty):
  odysseus/static/style.css; dark theme
  odysseus/static/app.js; 4083 lines of polished UI
  odysseus/static/fonts/FiraCode-*.woff2; Fira Code fonts

Hermes (personality):
  hermes-agent/hermes_cli/default_soul.py; SOUL.md template
  hermes-agent/ui-tui/src/content/faces.ts; spinner faces
  hermes-agent/ui-tui/src/content/verbs.ts; action verbs
  hermes-agent/hermes_cli/skin_engine.py; skin/theme engine

OpenClaw (professionalism):
  openclaw/src/cli/program/register-onboard.ts; onboarding register
  openclaw/ui/src/i18n/; 20 language system
  openclaw/src/cli/program/register-configure.ts; config wizard
```