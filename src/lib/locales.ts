/**
 * Allowed bot config `locale` values (single source of truth).
 * Documented in `.env` as BOT_ALLOWED_LOCALES for operators; runtime validation uses this module.
 */
export const ALLOWED_LOCALES = [
    'COMMON',
    'UNITED_KINGDOM',
    'AUSTRALIA',
    'SPAIN',
    'ITALY',
    'GERMANY',
    'DENMARK',
    'SWEDEN',
    'BULGARIA',
    'GREECE',
    'ARGENTINA',
    'MEXICO',
    'BRAZIL',
    'CANADA',
    'FINLAND',
] as const;

export type Locale = (typeof ALLOWED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'COMMON';

export function isValidLocale(value: unknown): value is Locale {
    return typeof value === 'string' && (ALLOWED_LOCALES as readonly string[]).includes(value);
}

export function allowedLocalesErrorMessage(): string {
    return `Invalid locale. Allowed: ${ALLOWED_LOCALES.join(', ')}`;
}
