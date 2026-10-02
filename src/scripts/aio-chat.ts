/**
 * Chat met AIO: de ronde AIO-knop midden in het menu opent een chatvenster in het midden van het scherm.
 * Vragen gaan naar de Worker in workers/aio-chat (Cloudflare), die Claude aanroept en het antwoord terugstreamt.
 * Het gesprek staat alleen in deze browser (sessionStorage, weg na het sluiten van het tabblad). De antwoorden gaan
 * ongewijzigd mee terug naar de Worker, ook de onzichtbare denkblokken: zo blijft het gesprek geldig voor Claude.
 */
const CHAT_URL = import.meta.env.PUBLIC_AIO_CHAT_URL || 'https://aio-chat.cool-shape-7891.workers.dev/chat';
const OPSLAG = 'aio-chat';
const MAX_BERICHTEN = 21;

type Blok = { type: string; text?: string };
type Bericht = { role: 'user'; content: string } | { role: 'assistant'; content: Blok[] };

const MELDINGEN: Record<string, string> = {
  limiet: 'Je hebt vandaag het maximum aantal vragen gesteld. Morgen kan het weer, of mail ons op support@reviewplus.io.',
  budget: 'AIO is voor vandaag even uitgepraat. Probeer het morgen nog eens, of plan een demo via de knop rechtsboven.',
  weigering: 'Daar kan ik je niet mee helpen. Vraag me gerust iets over AIO Plus en de labels.',
  'te-lang': 'Dit gesprek is lang geworden. Begin een nieuw gesprek met de knop bovenaan.',
  storing: 'Er ging iets mis. Probeer het zo nog eens.',
};

const $ = <T extends Element>(s: string, in_: ParentNode = document) => in_.querySelector<T>(s)!;
const knop = $<HTMLButtonElement>('.aio-knop');
const venster = $<HTMLElement>('#aio-chat');
const log = $<HTMLElement>('.chat-log', venster);
const welkom = $<HTMLElement>('.chat-welkom', venster);
const vorm = $<HTMLFormElement>('.chat-vorm', venster);
const veld = $<HTMLTextAreaElement>('#chat-vraag');
const stuurKnop = $<HTMLButtonElement>('.chat-stuur', venster);
const nieuwKnop = $<HTMLButtonElement>('.chat-nieuw', venster);

let berichten: Bericht[] = [];
let bezig = false;

function bewaar(): void {
  try { sessionStorage.setItem(OPSLAG, JSON.stringify(berichten)); } catch { /* opslag niet beschikbaar: gesprek blijft alleen in deze pagina */ }
}

function laad(): Bericht[] {
  try {
    const data = JSON.parse(sessionStorage.getItem(OPSLAG) ?? '[]');
    return Array.isArray(data) && data.length % 2 === 0 ? data : [];
  } catch { return []; }
}

/** Zet een tekst van AIO om in alinea's en lijstjes, met klikbare links. Nooit als HTML: alleen tekstknopen. */
function opmaak(el: HTMLElement, tekst: string): void {
  el.replaceChildren();
  for (const blok of tekst.trim().split(/\n{2,}/)) {
    const regels = blok.split('\n').filter((r) => r.trim());
    if (!regels.length) continue;
    let lijst: HTMLUListElement | null = null;
    let alinea: HTMLParagraphElement | null = null;
    for (const regel of regels) {
      const punt = /^\s*[-•*]\s+(.*)$/.exec(regel);
      if (punt) {
        alinea = null;
        lijst ??= el.appendChild(document.createElement('ul'));
        linkjes(lijst.appendChild(document.createElement('li')), punt[1]);
      } else {
        lijst = null;
        if (alinea) alinea.append(document.createElement('br'));
        else alinea = el.appendChild(document.createElement('p'));
        linkjes(alinea, regel);
      }
    }
  }
}

function linkjes(el: HTMLElement, tekst: string): void {
  const patroon = /(https?:\/\/[^\s)]+[^\s).,!?;:]|[\w.+-]+@[\w-]+\.[\w.-]*\w)/g;
  let vanaf = 0;
  for (const m of tekst.matchAll(patroon)) {
    el.append(tekst.slice(vanaf, m.index));
    const a = document.createElement('a');
    a.textContent = m[0];
    a.href = m[0].includes('@') && !m[0].startsWith('http') ? `mailto:${m[0]}` : m[0];
    if (a.href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
    el.append(a);
    vanaf = m.index + m[0].length;
  }
  el.append(tekst.slice(vanaf));
}

function bubbel(rol: 'jij' | 'aio' | 'melding', tekst = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `chat-bericht chat-${rol}`;
  if (rol === 'jij') el.textContent = tekst;
  else if (tekst) opmaak(el, tekst);
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

const tekstVan = (b: Bericht) => (typeof b.content === 'string' ? b.content : b.content.filter((k) => k.type === 'text').map((k) => k.text).join(''));

function toonGesprek(): void {
  log.querySelectorAll('.chat-bericht').forEach((el) => el.remove());
  welkom.hidden = berichten.length > 0;
  nieuwKnop.hidden = berichten.length === 0;
  for (const b of berichten) bubbel(b.role === 'user' ? 'jij' : 'aio', tekstVan(b));
}

function zetBezig(aan: boolean): void {
  bezig = aan;
  stuurKnop.disabled = aan;
  venster.classList.toggle('bezig', aan);
}

async function vraag(tekst: string): Promise<void> {
  const vraagTekst = tekst.trim().slice(0, 1000);
  if (!vraagTekst || bezig) return;
  welkom.hidden = true;
  nieuwKnop.hidden = false;
  if (berichten.length + 1 > MAX_BERICHTEN) { bubbel('melding', MELDINGEN['te-lang']); return; }

  const verzoek: Bericht[] = [...berichten, { role: 'user', content: vraagTekst }];
  bubbel('jij', vraagTekst);
  veld.value = '';
  pasHoogteAan();
  zetBezig(true);
  const antwoord = bubbel('aio');
  antwoord.classList.add('laadt');

  let tekstTotNu = '';
  let gepland = false;
  const teken = () => {
    if (gepland) return;
    gepland = true;
    requestAnimationFrame(() => {
      gepland = false;
      opmaak(antwoord, tekstTotNu);
      log.scrollTop = log.scrollHeight;
    });
  };
  const mislukt = (soort: string) => {
    antwoord.remove();
    bubbel('melding', MELDINGEN[soort] ?? MELDINGEN.storing);
    // De vraag telt niet mee in het gesprek; zet hem terug in het veld om opnieuw te proberen.
    if (soort === 'storing') veld.value = vraagTekst;
  };

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ berichten: verzoek }),
    });
    if (!res.ok || !res.body) {
      const fout = await res.json().catch(() => ({}));
      mislukt(fout.fout ?? 'storing');
      return;
    }
    const lezer = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let klaar = false;
    for (;;) {
      const { value, done } = await lezer.read();
      if (done) break;
      buffer += value;
      const regels = buffer.split('\n');
      buffer = regels.pop() ?? '';
      for (const regel of regels) {
        if (!regel.trim()) continue;
        const data = JSON.parse(regel);
        if (typeof data.t === 'string') {
          antwoord.classList.remove('laadt');
          tekstTotNu += data.t;
          teken();
        } else if (data.klaar) {
          klaar = true;
          berichten = [...verzoek, { role: 'assistant', content: data.inhoud }];
          bewaar();
          opmaak(antwoord, tekstVan(berichten[berichten.length - 1]));
          antwoord.classList.remove('laadt');
          if (typeof data.over === 'number' && data.over <= 3) {
            bubbel('melding', data.over === 0 ? 'Dit was je laatste vraag voor vandaag.' : `Je kunt vandaag nog ${data.over} ${data.over === 1 ? 'vraag' : 'vragen'} stellen.`);
          }
        } else if (data.fout) {
          mislukt(data.fout);
          return;
        }
      }
    }
    if (!klaar) mislukt('storing');
  } catch {
    mislukt('storing');
  } finally {
    zetBezig(false);
    log.scrollTop = log.scrollHeight;
  }
}

function pasHoogteAan(): void {
  veld.style.height = 'auto';
  veld.style.height = `${Math.min(veld.scrollHeight, 160)}px`;
}

function open(): void {
  if (!venster.hidden) { veld.focus(); return; }
  venster.hidden = false;
  knop.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('chat-open');
  requestAnimationFrame(() => venster.classList.add('zichtbaar'));
  veld.focus({ preventScroll: true });
}

function sluit(): void {
  if (venster.hidden) return;
  venster.classList.remove('zichtbaar');
  knop.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('chat-open');
  const weg = () => { if (!venster.classList.contains('zichtbaar')) venster.hidden = true; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) weg();
  else setTimeout(weg, 300);
  knop.focus({ preventScroll: true });
}

knop.addEventListener('click', () => (venster.hidden ? open() : sluit()));
$<HTMLButtonElement>('.chat-sluit', venster).addEventListener('click', sluit);
nieuwKnop.addEventListener('click', () => {
  if (bezig) return;
  berichten = [];
  bewaar();
  toonGesprek();
  veld.focus();
});
venster.addEventListener('keydown', (e) => { if (e.key === 'Escape') sluit(); });
welkom.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => void vraag(b.textContent ?? '')));
vorm.addEventListener('submit', (e) => { e.preventDefault(); void vraag(veld.value); });
veld.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void vraag(veld.value); }
});
veld.addEventListener('input', pasHoogteAan);

berichten = laad();
toonGesprek();
