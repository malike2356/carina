 TOOLS (27)
    
    | #   | Tool               | Purpose                                                            |
    |-----|--------------------|--------------------------------------------------------------------|
    | 1   | browser_navigate   | Open a URL in headless browser                                     |
    | 2   | browser_snapshot   | Get accessibility-tree snapshot of page                            |
    | 3   | browser_click      | Click element by ref ID                                            |
    | 4   | browser_type       | Type into input field                                              |
    | 5   | browser_press      | Press keyboard key (Enter, Tab, etc.)                              |
    | 6   | browser_scroll     | Scroll page up/down                                                |
    | 7   | browser_back       | Navigate back in history                                           |
    | 8   | browser_console    | Read browser JS console / evaluate JS                              |
    | 9   | browser_get_images | List all images on page with URLs                                  |
    | 10  | terminal           | Execute shell commands (foreground/background/PTY)                 |
    | 11  | read_file          | Read text files with line numbers                                  |
    | 12  | write_file         | Create or overwrite files                                          |
    | 13  | patch              | Find-and-replace edits or V4A patches                              |
    | 14  | search_files       | Regex content search or glob file search (ripgrep)                 |
    | 15  | process            | Manage background processes (poll, log, kill, wait, stdin)         |
    | 16  | delegate_task      | Spawn subagents for parallel/isolated work                         |
    | 17  | execute_code       | Run Python scripts that call Hermes tools                          |
    | 18  | memory             | Persistent memory across sessions (user + agent stores)            |
    | 19  | session_search     | Full-text search past conversation transcripts                     |
    | 20  | clarify            | Ask user multiple-choice or open-ended questions                   |
    | 21  | todo               | Session task tracking (pending/in_progress/completed)              |
    | 22  | cronjob            | Schedule recurring or one-shot autonomous jobs                     |
    | 23  | send_message       | Send messages to Telegram, Discord, Slack, Signal, Matrix, Yuanbao |
    | 24  | text_to_speech     | Convert text to voice (Edge/OpenAI/ElevenLabs)                     |
    | 25  | skill_view         | Load skill content and linked files                                |
    | 26  | skills_list        | List all available skills                                          |
    | 27  | skill_manage       | Create/patch/edit/delete skills                                    |
    
    
    
    SKILLS (113) by Category
    
    autonomous-ai-agents (6)
    claude-code codex hermes-agent kanban-codex-lane openclaw-integration opencode
    
    creative (20)
    architecture-diagram ascii-art ascii-video baoyu-article-illustrator baoyu-comic baoyu-infographic claude-design comfyui design-md excalidraw humanizer ideation manim-video p5js pixel-art popular-web-designs pretext sketch songwriting-and-ai-music touchdesigner-mcp
    
    data-science (1)
    jupyter-live-kernel
    
    devops (14)
    agent-coordination backup-migration carina-deploy carina-deploy-restart carina-marketing disk-space-management disk-space-reclamation file-system-operations kanban-orchestrator kanban-worker server-troubleshooting storage-cleanup webhook-subscriptions
    
    dogfood (1)
    dogfood
    
    email (1)
    himalaya
    
    gaming (2)
    minecraft-modpack-server pokemon-player
    
    github (6)
    codebase-inspection github-auth github-code-review github-issues github-pr-workflow github-repo-management
    
    mcp (1)
    native-mcp
    
    media (5)
    gif-search heartmula songsee spotify youtube-content
    
    memory-consolidation (1)
    memory-consolidation
    
    mlops (9)
    audiocraft-audio-generation dspy evaluating-llms-harness huggingface-hub llama-cpp obliteratus segment-anything-model serving-llms-vllm weights-and-biases
    
    note-taking (1)
    obsidian
    
    productivity (17)
    airtable client-proposals docx-extraction event-debrief google-workspace laud-agent-bridge laud-data-environment linear maps nano-pdf notion ocr-and-documents powerpoint scheduled-voice-briefings teams-meeting-pipeline working-with-laud
    
    propreneur (1)
    propreneur-development
    
    red-teaming (1)
    godmode
    
    research (8)
    archive-exploration arxiv blogwatcher comprehensive-investigation data-forensics llm-wiki polymarket research-paper-writing
    
    smart-home (1)
    openhue
    
    social-media (1)
    xurl
    
    software-development (14)
    carina-feature-build carina-standalone-build-deploy debugging-hermes-tui-commands hermes-agent-skill-authoring hermes-s6-container-supervision multi-agent-coding-orchestration multi-step-form node-inspect-debugger plan python-debugpy requesting-code-review spike subagent-driven-development systematic-debugging test-driven-development writing-plans xelox-property-deal-analysis
    
    yuanbao (1)
    yuanbao
    
    
    
    PLATFORM FEATURES (beyond tools/skills)
    
    - Multi-profile; isolated profiles with own skills, plugins, cron, memories
    - Multi-model; switch providers/models (DeepSeek, Anthropic, OpenAI, OpenRouter, etc.)
    - Multi-platform messaging; Telegram, Discord, Slack, Signal, Matrix, Yuanbao
    - Cron scheduler; recurring autonomous agent runs with TTS delivery
    - Background processes; long-running servers/builds with completion notifications
    - Subagent delegation; parallel isolated workers for complex tasks
    - Persistent memory; cross-session user profile + agent knowledge store
    - Session search; FTS5 full-text search over all past conversations
    - Skill system; reusable procedural knowledge with YAML frontmatter
    - Kanban integration; task board with worker/orchestrator roles
    - MCP client; native Model Context Protocol for external tool servers
    - TTS delivery; voice note output via Edge/OpenAI/ElevenLabs
    - Webhook subscriptions; event-driven agent triggers
    - Browser automation; headless browsing with JS evaluation
    

