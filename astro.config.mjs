// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const site = (env.SITE_URL || 'https://www.aioplus.ai').replace(/\/+$/, '');
// Voor de testversie op https://aioplus.github.io/aioplus-site: BASE_PATH=/aioplus-site
const rawBase = env.BASE_PATH || '/';
const base = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;

export default defineConfig({
  site,
  base,
  trailingSlash: 'never',
  build: { format: 'file' },
  output: 'static',
  integrations: [sitemap({ filter: (page) => !/\/404(\.html)?$/.test(page) })],
  vite: {
    plugins: [tailwindcss()],
    // Three.js (het heelal) is ±140 kB gecomprimeerd en laadt na de pagina; die omvang is bewust.
    build: { chunkSizeWarningLimit: 600 },
    define: {
      'import.meta.env.SITE_URL': JSON.stringify(site),
      'import.meta.env.BASE_PATH': JSON.stringify(base),
    },
  },
});
