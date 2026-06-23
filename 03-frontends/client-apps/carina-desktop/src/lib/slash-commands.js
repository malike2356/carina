export const BUILTIN_SLASH_COMMANDS = [
    { name: 'new', trigger: '/new', description: 'Start a fresh conversation', category: 'builtin' },
    { name: 'resume', trigger: '/resume', description: 'Resume the previous session thread', category: 'builtin' },
    { name: 'model', trigger: '/model', description: 'Switch LLM provider or model', category: 'builtin' },
    { name: 'help', trigger: '/help', description: 'Show command reference', category: 'builtin' },
    { name: 'clear', trigger: '/clear', description: 'Clear session memory', category: 'builtin' },
    { name: 'stop', trigger: '/stop', description: 'Interrupt the current reply', category: 'builtin' },
    { name: 'status', trigger: '/status', description: 'Show session and provider status', category: 'builtin' },
    { name: 'memories', trigger: '/memories', description: 'List stored memories', category: 'quick' },
    { name: 'research', trigger: '/research', description: 'Run deep research on a topic', category: 'quick' },
    { name: 'compare', trigger: '/compare', description: 'Compare providers on a prompt', category: 'quick' },
    { name: 'usage', trigger: '/usage', description: 'Show token usage and cost', category: 'quick' },
];
export function fuzzyFilterCommands(commands, query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        return commands.slice(0, 8);
    }
    const scored = commands
        .map((cmd) => {
        const name = cmd.name.toLowerCase();
        const desc = cmd.description.toLowerCase();
        const trigger = cmd.trigger.toLowerCase();
        let score = 0;
        if (name.startsWith(q))
            score += 4;
        if (trigger.startsWith(`/${q}`))
            score += 5;
        if (name.includes(q))
            score += 2;
        if (desc.includes(q))
            score += 1;
        if (trigger.includes(q))
            score += 2;
        return { cmd, score };
    })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.cmd.name.localeCompare(b.cmd.name));
    return scored.slice(0, 8).map((row) => row.cmd);
}
