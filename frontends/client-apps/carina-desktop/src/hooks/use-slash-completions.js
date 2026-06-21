import { useEffect, useMemo, useState } from 'react';
import { getCommands } from '../lib/gateway-client.js';
import { BUILTIN_SLASH_COMMANDS, fuzzyFilterCommands } from '../lib/slash-commands.js';
const CACHE_MS = 5 * 60 * 1000;
let cachedCommands = null;
let cachedAt = 0;
async function loadCommands() {
    if (cachedCommands && Date.now() - cachedAt < CACHE_MS) {
        return cachedCommands;
    }
    const commands = await getCommands();
    cachedCommands = commands.length > 0 ? commands : BUILTIN_SLASH_COMMANDS;
    cachedAt = Date.now();
    return cachedCommands;
}
export function useSlashCompletions(query) {
    const [commands, setCommands] = useState(BUILTIN_SLASH_COMMANDS);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        setLoading(true);
        void loadCommands()
            .then((result) => {
            if (active)
                setCommands(result);
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => {
            active = false;
        };
    }, []);
    const filtered = useMemo(() => fuzzyFilterCommands(commands, query), [commands, query]);
    return { commands: filtered, loading };
}
