/** Vervangt `@/config/site` van de website in de Worker (zie "alias" in wrangler.jsonc): alleen wat labels.ts nodig heeft. */
export const merk = { email: 'support@reviewplus.io' } as const;

export function mailto(onderwerp: string): string {
  return `mailto:${merk.email}?subject=${encodeURIComponent(onderwerp)}`;
}
