#!/usr/bin/env node
/**
 * Controleert alle interne links (href/src/srcset) in dist/ tegen de gebouwde bestanden.
 * Houdt rekening met BASE_PATH en met build.format "file" (/aanvragen → aanvragen.html).
 *   node scripts/linkcheck.mjs              → alleen intern
 *   node scripts/linkcheck.mjs --external   → ook externe links (HEAD/GET), waarschuwt alleen
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const rawBase = process.env.BASE_PATH || '/';
const BASE = rawBase === '/' ? '' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;
const external = process.argv.includes('--external');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function resolves(pathname) {
  let p = decodeURIComponent(pathname);
  if (BASE) {
    if (!p.startsWith(BASE)) return false;
    p = p.slice(BASE.length) || '/';
  }
  const clean = p.replace(/^\/+/, '');
  const candidates = clean === '' ? ['index.html'] : [clean, `${clean}.html`, join(clean, 'index.html')];
  return candidates.some((c) => existsSync(join(DIST, c)) && statSync(join(DIST, c)).isFile());
}

const files = walk(DIST).filter((f) => f.endsWith('.html'));
const broken = [];
const externals = new Set();
const attr = /\s(?:href|src)=["']([^"'#]+)[^"']*["']|\ssrcset=["']([^"']+)["']/g;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(attr)) {
    const urls = m[1] ? [m[1]] : m[2].split(',').map((s) => s.trim().split(/\s+/)[0]);
    for (const u of urls) {
      if (!u || /^(mailto:|tel:|data:|javascript:)/.test(u)) continue;
      if (/^https?:\/\//.test(u)) {
        externals.add(u);
        continue;
      }
      const { pathname } = new URL(u, 'http://x' + BASE + '/' + relative(DIST, file).replace(/\\/g, '/'));
      if (!resolves(pathname)) broken.push(`${relative(DIST, file)} → ${u}`);
    }
  }
}

console.log(`Linkcheck: ${files.length} pagina's, ${externals.size} unieke externe links.`);
if (broken.length) {
  console.error(`✖ ${broken.length} kapotte interne link(s):\n  ${[...new Set(broken)].join('\n  ')}`);
  process.exitCode = 1;
} else console.log('✓ Alle interne links werken.');

if (external) {
  const own = (process.env.SITE_URL || 'https://www.aioplus.ai').replace(/\/+$/, '');
  const skip = /(googletagmanager|connect\.facebook|challenges\.cloudflare|plausible\.io|localhost)/;
  for (const u of externals) {
    if (skip.test(u) || u.startsWith(own)) continue;
    try {
      const res = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 linkcheck' } });
      if (res.status >= 400) console.warn(`⚠ ${res.status} ${u}`);
    } catch (e) {
      console.warn(`⚠ ${u}: ${e.message}`);
    }
  }
}
