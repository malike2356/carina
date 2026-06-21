# Carina Mobile Native (Capacitor scaffold)

Status: scaffold only (DGR-D06, UCG-09). Use `/mobile` PWA companion for production today.

## Supported path now

1. Open `/mobile` on your phone.
2. Pair with `carina pair token` from desktop.
3. Add to home screen (manifest + service worker).

## Capacitor scaffold (future)

```bash
cd native/mobile
npm install
npx cap sync
```

Wraps the mobile web shell in a native WebView for push notifications and app store distribution.
