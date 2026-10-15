# AIO-chat (Cloudflare Worker)

De vragen aan AIO op aioplus.ai. AIO is daar een gids die op een klik uit het menu komt (`src/scripts/aio-gids.ts` in de site); vragen typ je in zijn ballon. Ze komen hier binnen en deze Worker vraagt Claude om een antwoord, dat hij terugstreamt naar de browser. Claude mag aan het eind één vervolgstap voorstellen met een label (`[[label:reviewplus]]`, `[[demo]]`, `[[labels]]`, zie `src/systeem.ts`); de site haalt dat label weg en maakt er een knop van.

- **Adres**: https://aio-chat.cool-shape-7891.workers.dev/chat (alleen `POST`, alleen vanaf de websites in `HERKOMST` in `wrangler.jsonc`).
- **Model**: Claude Sonnet 5.5 (`claude-sonnet-5-5`) met korte denkstappen (effort `low`); besluit Jordan 02-10-2026.
- **Wie AIO is**: de gedeelde kern in `src/aio-kern.ts` (toon, feiten, nooit zelf handelen, veiligheid), letterlijk gelijk aan de app en aan hub `docs/agent/AIO-PROMPT.md`. Niet hier wijzigen maar via de chat "AIO Plus - Agent".
- **Wat AIO weet**: de aanvulling voor de website in `src/systeem.ts`, met de labelteksten uit de site (`src/data/labels.ts`). Wijzig je die teksten, dan rolt de chat na de merge vanzelf opnieuw uit. AIO verzint geen prijzen, klanten of cijfers en verwijst daarvoor naar een demo of support@reviewplus.io.
- **Plafonds** (`wrangler.jsonc`, besluit Jordan 02-10-2026): `DAGBUDGET_USD` = $5 per dag voor alle bezoekers samen, `VRAGEN_PER_DAG` = 20 vragen per bezoeker per dag. Daarboven krijgt de bezoeker een nette melding. De teller (`src/teller.ts`, een Durable Object) bewaart alleen de stand van vandaag; een bezoeker is een hash van het IP-adres met een dagelijks nieuw zout, niet het IP-adres zelf.
- **Gesprek**: staat alleen in de browser van de bezoeker (sessionStorage) en gaat bij elke vraag mee. Antwoorden komen ongewijzigd terug, ook de onzichtbare denkblokken, zodat Claude het gesprek kan vervolgen. Maximaal 11 vragen per gesprek (21 berichten); daarna begint de gids stil een nieuw gesprek, want in de ballon zie je toch alleen de laatste vraag.

## Sleutels

| Sleutel | Waar | Wie |
|---|---|---|
| `ANTHROPIC_API_KEY` | Cloudflare → Workers → `aio-chat` → Instellingen → Variabelen en geheimen (type Geheim) | Jordan maakt een aparte sleutel "aioplus-site chat" in de Anthropic Console en plakt hem |
| `CLOUDFLARE_API_TOKEN` | GitHub → `aioplus-site` → Settings → Secrets and variables → Actions | Jordan: Cloudflare → My Profile → API Tokens → Create Token → sjabloon "Edit Cloudflare Workers", account "Support@reviewplus.io's Account" |

Een chat leest of plakt deze sleutels nooit.

## Uitrollen

De workflow `.github/workflows/chat.yml` controleert de Worker bij elke pull request en rolt hem uit na een merge naar main (of met "Run workflow"). Zonder `CLOUDFLARE_API_TOKEN` slaat hij de uitrol over met een waarschuwing.

## Lokaal testen

```bash
cd workers/aio-chat
npm install
npx wrangler dev --port 8787
```

Zet in `.dev.vars` (staat niet in git) `ANTHROPIC_API_KEY` en eventueel `ANTHROPIC_BASE_URL` voor een nagebootste Claude-server, en start de site met `PUBLIC_AIO_CHAT_URL=http://localhost:8787/chat npm run dev`.

## Kosten en logboek

Een vraag kost ongeveer een halve cent (systeemprompt uit de cache, antwoord van een paar honderd woorden). Fouten en vervallen denkblokken staan in de logs van de Worker (Cloudflare → Workers → `aio-chat` → Logs).
