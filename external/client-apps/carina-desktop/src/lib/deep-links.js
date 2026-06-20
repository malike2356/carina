import { listen } from '@tauri-apps/api/event';
function handleDeepLink(url, handlers) {
    const segments = url.pathname.split('/').filter(Boolean);
    const action = segments[0] ?? url.host;
    if (action === 'session' && segments[1]) {
        void handlers.selectSession(segments[1]);
        handlers.navigate('/');
        return;
    }
    if (action === 'install' && segments[1]) {
        void handlers.installSkill(decodeURIComponent(segments[1]));
        handlers.navigate('/skills');
        return;
    }
    if (action === 'pair') {
        const token = segments[1] ?? url.searchParams.get('token') ?? '';
        if (token)
            void handlers.completePairing(token);
        handlers.navigate('/settings/devices');
        return;
    }
    if (action === 'new') {
        void handlers.createSession();
        handlers.navigate('/');
    }
}
export async function setupDeepLinks(handlers) {
    const unsubs = [];
    try {
        const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
        await onOpenUrl((urls) => {
            for (const raw of urls) {
                handleDeepLink(new URL(raw), handlers);
            }
        });
    }
    catch {
        // Browser dev mode.
    }
    const stopDeepLink = await listen('deep-link', (event) => {
        try {
            handleDeepLink(new URL(event.payload), handlers);
        }
        catch {
            // Ignore malformed URLs.
        }
    });
    unsubs.push(stopDeepLink);
    const stopAction = await listen('deep-link-action', (event) => {
        const path = event.payload;
        if (path === '/new') {
            void handlers.createSession();
            handlers.navigate('/');
            return;
        }
        handlers.navigate(path);
    });
    unsubs.push(stopAction);
    const stopNavigate = await listen('navigate', (event) => {
        handlers.navigate(event.payload);
    });
    unsubs.push(stopNavigate);
    return () => {
        for (const stop of unsubs)
            stop();
    };
}
