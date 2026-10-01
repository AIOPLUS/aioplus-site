import { SITE_URL, BASE_PATH } from '@/config/site';

/** Pad binnen de site, rekening houdend met BASE_PATH. url('/') → '/aioplus-site' op de testversie. */
export function url(path = '/'): string {
  if (/^[a-z]+:/i.test(path) || path.startsWith('#')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (BASE_PATH === '/') return clean;
  return clean === '/' ? BASE_PATH : `${BASE_PATH}${clean}`;
}

/** Absolute URL (canonical, sitemap, schema, OG). */
export function absoluteUrl(path = '/'): string {
  if (/^[a-z]+:/i.test(path)) return path;
  return `${SITE_URL}${url(path)}`;
}
