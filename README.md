# aioplus-site

De website van AIO Plus: één platform, één AI-laag (AIO, powered by Claude) en vier labels (Review Plus, View Plus, Website Plus en Tab Plus). Een scroll-presentatie in de ruimte, gebouwd met Astro 7 (statisch), TypeScript, Tailwind 4 en Three.js.

## Het verhaal

1. **Opening**: losse sterren trekken samen tot een wolk en draaien uit tot een spiraalstelsel met vier armen in de labelkleuren, met AIO als fel centrum. "AIO" links, "Plus" rechts.
2. **Scrollen**: je vliegt het stelsel in; het valt uiteen in een sterrenhemel en de zin "Eén AI-motor. Vier gespecialiseerde labels." verschijnt.
3. **Labelmenu**: de sterren vliegen naar vier kwarten (de volgorde van het beeldmerk) en elk kwart kleurt vanuit het midden. Stijl: nevels in de labelkleur. Drie andere stijlen (stelsels, planeten, horizon) staan klaar voor later (`AUTOMATISCH_WISSELEN` in `src/scripts/heelal.ts`). Het kwart onder de muis wordt groter.
4. **Inzoomen**: "Ontdek" (of een label in het hoofdmenu) laat het label het scherm vullen; daarna volgt een presentatie per label met kerncijfers en onderdelen.

**AIO-chat**: de ronde AIO-knop midden in het hoofdmenu opent een chatvenster in het midden van het scherm, waar bezoekers vragen stellen aan AIO (Claude Sonnet 5.5). View Plus en Tab Plus staan daarom rechts uitgelijnd. De chat praat met een eigen Worker bij Cloudflare (`workers/aio-chat`, uitleg in de README daar); het adres staat in `src/scripts/aio-chat.ts` (of GitHub-variabele `PUBLIC_AIO_CHAT_URL`).

Langs de rand stroomt een regenboog van de vier labelkleuren; met de muis op een label wordt die gloed (en het tabje rechts) de kleur van dat label.

## Werken

```bash
npm install
npm run dev      # http://localhost:4321
npm run check    # typecheck, lint, build, linkcheck
```

Handig bij het testen: `?t=9` slaat de intro over, `?stijl=planeet` toont het menu in een andere stijl.

Met `prefers-reduced-motion` staat alles stil en onder elkaar; zonder WebGL blijft de pagina bruikbaar.

## Live

- **Live**: https://www.aioplus.ai sinds 02-10-2026 (GitHub Pages). aioplus.ai en de oude testversie https://aioplus.github.io/aioplus-site sturen door naar www.
- **GitHub**: variabelen `SITE_URL=https://www.aioplus.ai` en `BASE_PATH=/`; het eigen domein en HTTPS staan in Settings → Pages (geen CNAME-bestand nodig bij uitrol via Actions).
- **DNS bij GoDaddy**: apex (`@`) A-records naar 185.199.108.153, 185.199.109.153, 185.199.110.153 en 185.199.111.153; `www` CNAME naar `aioplus.github.io`.
- Na een uitrol kan GitHub Pages tot 10 minuten de oude versie tonen (cache); controleer met `?v=<n>`.

## Nog open

- KvK-nummer op de site (verplicht voor een zakelijke site); de footer is op verzoek van Jordan weggehaald.
- Een eigen formulier in plaats van de e-mailknoppen (via Make, chat "AIO Plus - Make").
- Een Open Graph-afbeelding voor gedeelde links.
- De cijfers van Review Plus komen nog van EmbedMyReviews; controleren bij de overstap naar de eigen app.
