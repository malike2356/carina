import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetI18nCacheForTests,
  catalogSlice,
  getLanguage,
  loadLocaleCatalog,
  normalizeLocale,
  parseAcceptLanguage,
  resolveLocale,
  t,
} from './index.js';
import { resolveLocalesDir } from './locale-path.js';

describe('i18n', () => {
  afterEach(() => {
    _resetI18nCacheForTests();
    delete process.env.CARINA_LANGUAGE;
    delete process.env.CARINA_LOCALE;
  });

  it('loads locale catalogs from a deterministic directory', () => {
    expect(resolveLocalesDir()).toContain('locales');
    const en = loadLocaleCatalog('en');
    expect(en['web.login.submit']).toBe('Sign in');
  });

  it('translates Spanish login strings end to end', () => {
    expect(t('web.login.submit', undefined, 'es')).toBe('Iniciar sesion');
    expect(t('web.login.password', undefined, 'es')).toBe('Contrasena');
  });

  it('falls back to English when a key is missing in Spanish', () => {
    _resetI18nCacheForTests();
    const value = t('web.login.title', undefined, 'es');
    expect(value).toBe('Carina');
    expect(t('does.not.exist', undefined, 'es')).toBe('does.not.exist');
  });

  it('interpolates parameters', () => {
    expect(t('cli.locale.current', { locale: 'es' }, 'en')).toBe('Active locale: es');
  });

  it('normalizes locale aliases', () => {
    expect(normalizeLocale('spanish')).toBe('es');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('fr')).toBe('en');
  });

  it('resolves locale from env and Accept-Language', () => {
    process.env.CARINA_LANGUAGE = 'es';
    expect(getLanguage()).toBe('es');
    delete process.env.CARINA_LANGUAGE;
    expect(resolveLocale({ acceptLanguage: 'es-ES,en;q=0.8' })).toBe('es');
    expect(parseAcceptLanguage('es-MX,en;q=0.5')).toBe('es');
  });

  it('returns catalog slices by prefix', () => {
    const slice = catalogSlice('en', 'web.login');
    expect(slice['web.login.submit']).toBe('Sign in');
    expect(slice['web.hostedLogin.submit']).toBeUndefined();
  });
});
