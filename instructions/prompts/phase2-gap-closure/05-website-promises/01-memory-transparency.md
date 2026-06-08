# Phase 2.15 — Memory Transparency (View/Edit UI)

## Goal
Build the memory transparency feature — users can view and edit Carina's memory through a web interface. This fulfills "Memory transparency (view/edit)" on the comparison table and makes the persistent memory claim tangible.

## Files to create
```
packages/cloud/web/
  memory/
    index.html                  — Memory management page
    css/memory.css
    js/
      memory-viewer.js          — Display all memory entries
      memory-editor.js          — Edit/add/delete entries
      memory-search.js          — Search/filter memory

packages/cloud/src/
  api/
    memory-api.ts               — REST API for memory management
    routes/
      memory.routes.ts          — GET/PUT/DELETE /api/memory
```

## Memory API
```
GET    /api/memory              — List all memory entries
GET    /api/memory/{id}         — Get single entry
POST   /api/memory              — Create new entry
PUT    /api/memory/{id}         — Update entry
DELETE /api/memory/{id}         — Delete entry
GET    /api/memory/search?q=    — Search memory by text
GET    /api/memory/stats        — Memory usage stats
```

## UI layout
```
┌──────────────────────────────────────────────────────────────┐
│ MEMORY MANAGEMENT                    [Memory stats: 78% full] │
├──────────────────────────────────────────────────────────────┤
│ [Search memory...]                          [+ New Entry]     │
├──────────┬───────────────────────────────────────────────────┤
│ CATEGORY │ ENTRIES                                            │
├──────────┼───────────────────────────────────────────────────┤
│ User      │ Laud prefers concise responses                   │
│ Profile   │ He/Him. MSc Cyber Security. UK/Ghana.            │
│           │ [Edit] [Delete]                                  │
│           │                                                   │
│ Agent     │ Project uses PostgreSQL 16 on port 5432          │
│ Notes     │ [Edit] [Delete]                                  │
│           │                                                   │
│           │ TuinApp Docker stack at ~/tuinapp/app            │
│           │ [Edit] [Delete]                                  │
│           │                                                   │
│           │ Contabo VPS at 80.190.81.208                    │
│           │ [Edit] [Delete]                                  │
│           │                                                   │
│           │ Carina Extended specs built for propreneur-v2    │
│           │ [Edit] [Delete]                                  │
├──────────┴───────────────────────────────────────────────────┤
│ Memory compression tips:                                      │
│ • Remove stale entries weekly                                │
│ • Merge related facts into single entries                    │
│ • Delete task-specific entries after completion              │
│ [Auto-compress now]                                          │
└──────────────────────────────────────────────────────────────┘
```

## Add entry modal
```
┌──────────────────────────────────────┐
│ NEW MEMORY ENTRY                      │
│                                       │
│ Category: [User Profile ▼]            │
│                                       │
│ Content:                              │
│ ┌───────────────────────────────────┐ │
│ │                                   │ │
│ │                                   │ │
│ └───────────────────────────────────┘ │
│                                       │
│ Priority: [Normal ▼]                  │
│                                       │
│     [Cancel]    [Save Entry]          │
└──────────────────────────────────────┘
```

## Memory stats
```
Memory usage: 1,842 / 2,200 chars (84%)
User profile:   772 / 1,375 chars (56%)
Agent notes:  1,070 / 2,200 chars (49%)

Last compressed: Never
Auto-compress threshold: 90%

Recommendation: Memory is healthy. No action needed.
```

## What this proves to users
1. Memory is real — they can see everything Carina remembers
2. Memory is controllable — they can edit, delete, or add entries
3. Memory is transparent — nothing is hidden
4. Memory is bounded — they can see the limits and manage them

This is the feature the comparison table claims Hermes doesn't have.

## Verification
```bash
# 1. View memory page
open https://console.carinaai.uk/memory
# Expected: all memory entries displayed

# 2. Search memory
# Type "PostgreSQL" in search
# Expected: entries mentioning PostgreSQL

# 3. Edit entry
# Click Edit, change text, Save
# Expected: entry updated, change visible in next chat session

# 4. Delete entry
# Click Delete, confirm
# Expected: entry removed, no longer in memory

# 5. Add entry
# Click New Entry, fill form, Save
# Expected: new entry appears, Carina references it in next chat
```
