const env = import.meta.env;

function normBase(raw: string | undefined): string {
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

/** Absolute origin zonder trailing slash, bv. https://www.aioplus.ai */
export const SITE_URL = (env.SITE_URL || 'https://www.aioplus.ai').replace(/\/+$/, '');
/** "/" op aioplus.ai, "/aioplus-site" op de testversie (GitHub Pages zonder eigen domein). */
export const BASE_PATH = normBase(env.BASE_PATH);

/** Merkgegevens van AIO Plus. KvK en adres vult Jordan later in. */
export const merk = {
  naam: 'AIO Plus',
  juridischeNaam: 'PIEROT SALES',
  email: 'support@reviewplus.io',
  beschrijving:
    'AIO Plus: één platform met één AI-laag (AIO, powered by Claude) en vier labels: Review Plus, View Plus, Website Plus en Tab Plus.',
} as const;

/**
 * Knoppen zonder eigen formulier openen voorlopig een e-mail (besluit Jordan 01-10-2026).
 * Later vervangen door een formulier via Make.
 */
export function mailto(onderwerp: string): string {
  return `mailto:${merk.email}?subject=${encodeURIComponent(onderwerp)}`;
}
