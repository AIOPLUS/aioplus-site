import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam, BetaContentBlockParam, BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { SYSTEEM } from './systeem';
import { Teller } from './teller';

export { Teller };

/**
 * AIO-chat van aioplus.ai: de website stuurt het gesprek hierheen, deze Worker vraagt Claude om een antwoord en streamt
 * dat terug. De sleutel van Anthropic staat alleen hier (Cloudflare-secret ANTHROPIC_API_KEY, Jordan plakt hem zelf).
 *
 * Model: Claude Sonnet 5.5 met korte denkstappen (effort "low"), besluit Jordan 02-10-2026.
 * Plafonds: VRAGEN_PER_DAG per bezoeker en DAGBUDGET_USD voor alle bezoekers samen (src/teller.ts).
 *
 * Het gesprek bewaart de browser, niet de server. Elk antwoord gaat volledig terug naar de browser (ook de lege
 * denkblokken met hun handtekening) en de browser stuurt het bij de volgende vraag ongewijzigd mee: zo blijft het gesprek
 * "append-only" en blijven de denkstappen geldig. Klopt er toch iets niet, dan laat de API die denkstappen vallen
 * (prefix_mismatch_behavior "drop_block") in plaats van een fout te geven.
 *
 * Antwoord aan de browser: regels JSON (NDJSON): {"t": "..."} per stukje tekst, tot slot {"klaar": true, "inhoud": [...],
 * "over": n} of {"fout": "..."}.
 */
interface Env {
  TELLER: DurableObjectNamespace<Teller>;
  ANTHROPIC_API_KEY?: string;
  /** Alleen voor lokale tests (.dev.vars): een nagebootste Claude-server. */
  ANTHROPIC_BASE_URL?: string;
  HERKOMST: string;
  DAGBUDGET_USD: string;
  VRAGEN_PER_DAG: string;
}

const MODEL = 'claude-sonnet-5-5';
const MAX_BERICHTEN = 21; // 11 vragen en 10 antwoorden; daarna begint de bezoeker een nieuw gesprek
const MAX_VRAAG = 1000; // tekens per vraag
const MAX_BODY = 300_000; // bytes; denkblokken met handtekening kunnen enkele kB zijn

// Prijzen Claude Sonnet 5.5 in miljoenste dollars per token: invoer $2, cache schrijven $2,50, cache lezen $0,20 en
// uitvoer $10 per miljoen tokens.
function kosten(u: BetaUsage): number {
  return Math.ceil(
    u.input_tokens * 2 + (u.cache_creation_input_tokens ?? 0) * 2.5 + (u.cache_read_input_tokens ?? 0) * 0.2 + u.output_tokens * 10,
  );
}

function cors(herkomst: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': herkomst,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data: unknown, status: number, kop: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...kop, 'Content-Type': 'application/json; charset=utf-8' } });
}

type Fout = { fout: string };

/** Controleert het gesprek uit de browser en maakt er berichten voor Claude van. Alleen bekende velden gaan mee. */
function leesGesprek(invoer: unknown): BetaMessageParam[] | Fout {
  const berichten = (invoer as { berichten?: unknown })?.berichten;
  if (!Array.isArray(berichten) || berichten.length < 1 || berichten.length > MAX_BERICHTEN || berichten.length % 2 === 0) {
    return { fout: Array.isArray(berichten) && berichten.length > MAX_BERICHTEN ? 'te-lang' : 'ongeldig' };
  }
  const uit: BetaMessageParam[] = [];
  for (const [i, b] of berichten.entries()) {
    const rol = i % 2 === 0 ? 'user' : 'assistant';
    if (b?.role !== rol) return { fout: 'ongeldig' };
    if (rol === 'user') {
      if (typeof b.content !== 'string') return { fout: 'ongeldig' };
      const vraag = b.content.trim();
      if (!vraag || vraag.length > MAX_VRAAG) return { fout: 'ongeldig' };
      uit.push({ role: 'user', content: vraag });
      continue;
    }
    if (!Array.isArray(b.content) || b.content.length < 1 || b.content.length > 8) return { fout: 'ongeldig' };
    const blokken: BetaContentBlockParam[] = [];
    for (const k of b.content) {
      if (k?.type === 'text' && typeof k.text === 'string') blokken.push({ type: 'text', text: k.text });
      else if (k?.type === 'thinking' && typeof k.thinking === 'string' && typeof k.signature === 'string')
        blokken.push({ type: 'thinking', thinking: k.thinking, signature: k.signature });
      else if (k?.type === 'redacted_thinking' && typeof k.data === 'string') blokken.push({ type: 'redacted_thinking', data: k.data });
      else return { fout: 'ongeldig' };
    }
    uit.push({ role: 'assistant', content: blokken });
  }
  return uit;
}

/** Alleen de blokken die de browser bij de volgende vraag terug moet sturen, met precies de velden van de API. */
function bewaarBlokken(inhoud: Anthropic.Beta.Messages.BetaContentBlock[]): BetaContentBlockParam[] {
  return inhoud.flatMap((k): BetaContentBlockParam[] => {
    if (k.type === 'text') return [{ type: 'text', text: k.text }];
    if (k.type === 'thinking') return [{ type: 'thinking', thinking: k.thinking, signature: k.signature }];
    if (k.type === 'redacted_thinking') return [{ type: 'redacted_thinking', data: k.data }];
    return [];
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const herkomst = request.headers.get('Origin') ?? '';
    const toegestaan = env.HERKOMST.split(',').map((h) => h.trim());
    if (!toegestaan.includes(herkomst)) return new Response('Niet toegestaan', { status: 403 });
    const kop = cors(herkomst);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: kop });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/chat') return json({ fout: 'ongeldig' }, 404, kop);

    const lengte = Number(request.headers.get('Content-Length') ?? '0');
    if (lengte > MAX_BODY) return json({ fout: 'te-lang' }, 413, kop);
    const tekst = await request.text();
    if (tekst.length > MAX_BODY) return json({ fout: 'te-lang' }, 413, kop);
    let invoer: unknown;
    try {
      invoer = JSON.parse(tekst);
    } catch {
      return json({ fout: 'ongeldig' }, 400, kop);
    }
    const berichten = leesGesprek(invoer);
    if ('fout' in berichten) return json(berichten, 400, kop);

    if (!env.ANTHROPIC_API_KEY) {
      console.error('AIO-chat: secret ANTHROPIC_API_KEY ontbreekt');
      return json({ fout: 'storing' }, 503, kop);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'onbekend';
    const teller = env.TELLER.get(env.TELLER.idFromName('aio-chat'));
    const plek = await teller.reserveer(ip, Number(env.VRAGEN_PER_DAG), Number(env.DAGBUDGET_USD) * 1_000_000);
    if (!plek.ok) return json({ fout: plek.reden === 'budget' ? 'budget' : 'limiet' }, 429, kop);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1, timeout: 60_000 });
    const stroom = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: SYSTEEM, cache_control: { type: 'ephemeral' } }],
      thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      output_config: { effort: 'low' },
      messages: berichten,
      betas: ['thinking-binding-controls-2026-08-01'],
    });

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const schrijver = writable.getWriter();
    const codeer = new TextEncoder();
    const stuur = (regel: object) => schrijver.write(codeer.encode(`${JSON.stringify(regel)}\n`)).catch(() => {});

    ctx.waitUntil(
      (async () => {
        let tekstGestuurd = false;
        try {
          stroom.on('text', (stukje) => {
            tekstGestuurd = true;
            void stuur({ t: stukje });
          });
          const antwoord = await stroom.finalMessage();
          await teller.boek(kosten(antwoord.usage));
          const gevallen = antwoord.input_transformations?.length ?? 0;
          if (gevallen) console.warn(`AIO-chat: ${gevallen} denkblok(ken) vervallen`, JSON.stringify(antwoord.input_transformations));
          if (antwoord.stop_reason === 'refusal') {
            // Geweigerd: de browser gooit deze vraag en het halve antwoord weg en toont een vaste tekst.
            await stuur({ fout: 'weigering' });
          } else {
            await stuur({ klaar: true, inhoud: bewaarBlokken(antwoord.content), over: plek.over, afgekapt: antwoord.stop_reason === 'max_tokens' });
          }
        } catch (e) {
          if (e instanceof Anthropic.AuthenticationError) console.error('AIO-chat: ANTHROPIC_API_KEY klopt niet');
          else if (e instanceof Anthropic.APIError) console.error(`AIO-chat: API-fout ${e.status}`, e.message);
          else console.error('AIO-chat: aanroep mislukt', e);
          if (!tekstGestuurd) await teller.geefTerug(ip);
          await stuur({ fout: 'storing' });
        } finally {
          await schrijver.close().catch(() => {});
        }
      })(),
    );

    return new Response(readable, {
      headers: { ...kop, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  },
} satisfies ExportedHandler<Env>;
