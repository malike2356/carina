import type { Translations } from './locales/en';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type LocaleMessages = DeepPartial<Translations>;
