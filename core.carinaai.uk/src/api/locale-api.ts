import type { Express, Request, Response } from 'express';
import {
  SUPPORTED_LOCALES,
  catalogSlice,
  listLocaleFiles,
  normalizeLocale,
  resolveLocale,
  t,
} from '../i18n/index.js';

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie ?? '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function mountLocaleRoutes(app: Express): void {
  app.get('/api/locale', (req: Request, res: Response) => {
    const explicit = typeof req.query.lang === 'string' ? req.query.lang : undefined;
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : undefined;
    const locale = resolveLocale({
      explicit,
      acceptLanguage: req.headers['accept-language'],
      cookie: readCookie(req, 'carina_locale'),
    });

    res.cookie('carina_locale', locale, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: false,
    });

    const strings = prefix ? catalogSlice(locale, prefix) : catalogSlice(locale, 'web');
    res.json({
      locale,
      fallback: 'en',
      supported: [...SUPPORTED_LOCALES],
      strings,
    });
  });

  app.get('/api/locale/supported', (_req: Request, res: Response) => {
    res.json({
      supported: [...SUPPORTED_LOCALES],
      files: listLocaleFiles(),
    });
  });

  app.post('/api/locale', (req: Request, res: Response) => {
    const locale = normalizeLocale(String(req.body?.locale ?? req.body?.lang ?? ''));
    res.cookie('carina_locale', locale, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: false,
    });
    res.json({
      ok: true,
      locale,
      message: t('cli.locale.current', { locale }, locale),
    });
  });
}
