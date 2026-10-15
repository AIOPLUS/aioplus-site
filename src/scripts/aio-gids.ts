/**
 * AIO als gids op aioplus.ai (vervangt het chatvenster). De ronde AIO-knop midden in het menu stuurt AIO op pad of haalt
 * hem terug. AIO reist mee terwijl je scrolt, vertelt per onderdeel kort wat je ziet, wijst aan waar je moet klikken en
 * kan het na akkoord zelf doen. Vragen gaan naar de Worker in workers/aio-chat (Claude); die kan één actie voorstellen
 * met een label als [[label:reviewplus]], [[demo]] of [[labels]] aan het eind van het antwoord.
 *
 * Het gesprek staat alleen in deze browser (sessionStorage). De antwoorden gaan ongewijzigd mee terug naar de Worker, ook
 * de onzichtbare denkblokken: zo blijft het gesprek geldig voor Claude.
 * Ontwerp en afspraken: hub docs/agent/AIO-GIDS.md (eigenaar: chat "AIO Plus - Agent").
 */
import { meld, zetLabel, type AioLabel } from '@/scripts/aio-wezen/brein';
import type { AioGids, GidsKnop } from '@/scripts/aio-wezen/gids';

const CHAT_URL = import.meta.env.PUBLIC_AIO_CHAT_URL || 'https://aio-chat.cool-shape-7891.workers.dev/chat';
const GESPREK = 'aio-chat';
const GEZIEN = 'aio-gids-gezien';
const STAND = 'aio-gids';
const MAX_BERICHTEN = 21;

type Blok = { type: string; text?: string };
type Bericht = { role: 'user'; content: string } | { role: 'assistant'; content: Blok[] };
type LabelId = Exclude<AioLabel, 'aio'>;

const MELDINGEN: Record<string, string> = {
  limiet: 'Je hebt vandaag het maximum aantal vragen gesteld. Morgen kan het weer, of mail ons op support@reviewplus.io.',
  budget: 'Ik ben voor vandaag even uitgepraat. Probeer het morgen nog eens, of plan een demo via de knop rechtsboven.',
  weigering: 'Daar kan ik je niet mee helpen. Vraag me gerust iets over AIO Plus en de labels.',
  storing: 'Er ging iets mis. Probeer het zo nog eens.',
};

const $ = <T extends Element>(s: string) => document.querySelector<T>(s);
const menuKnop = $<HTMLButtonElement>('.aio-knop')!;
const labelMenu = $<HTMLElement>('#labels');
const reis = $<HTMLElement>('.reis');
const beweging = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** De labels zoals de pagina ze toont (naam, kleur, knoppen), uit de DOM: zo zegt AIO nooit iets anders dan de pagina. */
const LABELS = [...document.querySelectorAll<HTMLElement>('.label[data-label]')].map((el) => ({
  id: el.dataset.label as LabelId,
  naam: el.querySelector('.naam')?.textContent?.trim() ?? '',
  oms: el.querySelector('.oms')?.textContent?.trim() ?? '',
  kleur: el.style.getPropertyValue('--k').trim(),
}));
const label = (id: LabelId) => LABELS.find((l) => l.id === id)!;

// de opslag zelf kan al een fout geven (privévenster, geblokkeerde cookies): daarom pas binnen try
const opslag = (soort: 'local' | 'session') => (soort === 'local' ? localStorage : sessionStorage);
function lees<T>(soort: 'local' | 'session', sleutel: string, anders: T): T {
  try { return JSON.parse(opslag(soort).getItem(sleutel) ?? 'null') ?? anders; } catch { return anders; }
}
function schrijf(soort: 'local' | 'session', sleutel: string, waarde: unknown): void {
  try { opslag(soort).setItem(sleutel, JSON.stringify(waarde)); } catch { /* opslag niet beschikbaar: alleen voor deze pagina */ }
}

// ---------- de gids laden ----------

let gids: AioGids | null = null;
let laden: Promise<AioGids> | null = null;
function laadGids(): Promise<AioGids> {
  laden ??= import('@/scripts/aio-wezen/gids').then(({ AioGids }) => {
    gids = new AioGids({
      menuKnop,
      opVraag: (v) => void vraag(v),
      opZichtbaar: (aan) => schrijf('local', STAND, aan ? 'aan' : 'uit'),
      plaatshouder: 'Vraag het AIO',
      noot: 'AIO kan fouten maken. Vul geen persoonlijke gegevens in.',
    });
    return gids;
  });
  return laden;
}

const gezien = new Set<string>(lees<string[]>('session', GEZIEN, []));
function eersteKeer(id: string): boolean {
  if (gezien.has(id)) return false;
  gezien.add(id);
  schrijf('session', GEZIEN, [...gezien]);
  return true;
}

// ---------- voorstellen: "klik hier", of AIO doet het na akkoord ----------

/**
 * AIO wijst het element aan en zegt waar je moet klikken. "Doe jij het maar" = akkoord: AIO vliegt erheen en klikt.
 * Klikt de bezoeker zelf, dan is het ook goed.
 */
let lopendVoorstel: AbortController | null = null;

function stelVoor(g: AioGids, el: HTMLElement, opties: { knop: string; wat: string; klaar: string; focus?: boolean }): void {
  // één voorstel tegelijk: een vorig voorstel (ook op hetzelfde element) luistert niet meer mee
  lopendVoorstel?.abort();
  const voorstel = new AbortController();
  lopendVoorstel = voorstel;
  let nr = 0;
  g.zeg({
    tekst: `Klik op «${opties.knop}». ${opties.wat}\n\nOf zal ik het voor je doen?`,
    wijs: el,
    knoppen: [
      { tekst: 'Doe jij het maar', soort: 'akkoord', doe: async () => {
        voorstel.abort();
        if (await g.doe(el, `Ik klik voor je op «${opties.knop}».`)) g.zeg({ tekst: opties.klaar, vluchtig: true });
        else g.zeg({ tekst: 'Gestopt. Er is niets gebeurd.', vluchtig: true });
      } },
      { tekst: 'Ik doe het zelf', doe: () => { g.zeg({ tekst: `Prima. Klik op «${opties.knop}»: ik wijs het aan.`, wijs: el }); nr = g.berichtNr; } },
    ],
  });
  nr = g.berichtNr;
  // klikt de bezoeker zelf, dan is het ook goed; maar alleen zolang AIO intussen niets anders zei
  el.addEventListener('click', () => {
    voorstel.abort();
    if (g.berichtNr !== nr) return;
    meld('actie');
    g.zeg({ tekst: opties.klaar, vluchtig: true });
  }, { signal: voorstel.signal });
  if (opties.focus) g.focusKnop();
}

/** Naar een label: in het labelmenu de knop "Ontdek", anders het label in het menu bovenaan. */
function naarLabel(g: AioGids, id: LabelId, focus = false): void {
  const l = label(id);
  // het hoofdstuk zelf hoeft AIO daarna niet nog eens aan te kondigen
  eersteKeer(`label-${id}`);
  const ontdek = $<HTMLElement>(`[data-zoom="${id}"]`);
  const opKaart = ontdek && ontdek.getBoundingClientRect().height > 0 && getComputedStyle(ontdek.closest('.inhoud') ?? ontdek).opacity !== '0' && !labelMenu?.dataset.gekozen;
  const el = opKaart ? ontdek : $<HTMLElement>(`.hoofdmenu [data-ga="${id}"]`)!;
  stelVoor(g, el, {
    knop: opKaart ? `Ontdek ${l.naam}` : `${l.naam}`,
    wat: opKaart ? `Dan zoom je in op ${l.naam}.` : `Dat staat bovenaan in het menu; dan ga je naar ${l.naam}.`,
    klaar: `Dit is ${l.naam}. Scroll maar verder, ik vertel onderweg wat je ziet.`,
    focus,
  });
}

function naarDemo(g: AioGids, focus = false): void {
  stelVoor(g, $<HTMLElement>('header .pil')!, {
    knop: 'Plan een demo',
    wat: 'Dan opent je mailprogramma met een mail aan ons team.',
    klaar: 'Je mailprogramma gaat open. Schrijf erbij wat je zaak doet, dan nemen we contact op.',
    focus,
  });
}

function naarLabels(g: AioGids, focus = false): void {
  const terug = labelMenu?.dataset.gekozen ? $<HTMLElement>('.terug') : null;
  if (terug) {
    stelVoor(g, terug, { knop: '← Alle labels', wat: 'Dan zie je de vier labels weer.', klaar: 'Hier zijn ze weer, alle vier.', focus });
    return;
  }
  (labelMenu ?? reis)?.scrollIntoView({ block: 'end', behavior: beweging() ? 'smooth' : 'auto' });
  g.zeg({ tekst: 'Ik scroll je naar de vier labels.', vluchtig: true });
}

/** Keuze uit de vier labels, als pillen (kost niets: geen vraag aan Claude). */
function kiesLabel(g: AioGids, tekst: string): void {
  const vragen: Record<LabelId, string> = { reviewplus: 'Meer reviews', viewplus: 'Social media', websiteplus: 'Een website', tabplus: 'Een kassa' };
  g.zeg({
    tekst,
    ideeen: LABELS.map((l): GidsKnop => ({ tekst: vragen[l.id], doe: () => naarLabel(g, l.id, true) })),
  });
}

// ---------- rondleiding ----------

function rondleiding(g: AioGids, stap = 0): void {
  const stappen: { el: Element | null; tekst: string }[] = [
    { el: $('.hoofdmenu'), tekst: 'Bovenaan staan de vier labels. Eén klik en je springt naar het label dat je zoekt.' },
    { el: menuKnop, tekst: 'Hier woon ik. Klik op mij om me weg te sturen, of om me terug te halen als je me nodig hebt.' },
    { el: $('header .pil'), tekst: 'Wil je het in het echt zien? Plan een demo: dan opent je mailprogramma.' },
  ];
  const s = stappen[stap];
  const laatste = stap === stappen.length - 1;
  g.zeg({
    kop: `Stap ${stap + 1} van ${stappen.length}`,
    tekst: s.tekst,
    wijs: s.el,
    knoppen: [
      { tekst: laatste ? 'Klaar' : 'Volgende', soort: 'akkoord', doe: () => (laatste ? g.zeg({ tekst: 'Scroll maar verder, ik vertel onderweg wat je ziet.', vluchtig: true }) : rondleiding(g, stap + 1)) },
      ...(laatste ? [] : [{ tekst: 'Stop', doe: () => g.zeg({ tekst: 'Goed. Ik ben er als je me nodig hebt.', vluchtig: true }) }]),
    ],
  });
  g.focusKnop();
}

// ---------- groeten ----------

function groet(g: AioGids, zelfGeroepen: boolean): void {
  const ideeen: GidsKnop[] = [
    { tekst: 'Leid me rond', doe: () => rondleiding(g) },
    { tekst: 'Welk label past bij mij?', doe: () => kiesLabel(g, 'Waar wil je mee verder? Kies wat het meest past.') },
    { tekst: 'Wat doet AIO Plus?', doe: () => void vraag('Wat doet AIO Plus?') },
  ];
  g.zeg(zelfGeroepen
    ? { tekst: 'Hoi, ik ben AIO. Waar kan ik je mee helpen?', ideeen }
    : { tekst: 'Hoi, ik ben AIO. Ik reis met je mee en vertel onderweg wat je ziet. Liever zelf rondkijken? Stuur me weg met het kruisje; je vindt me terug in het menu.', ideeen, vluchtig: true });
}

// ---------- vragen aan Claude ----------

let berichten: Bericht[] = lees<Bericht[]>('session', GESPREK, []);
if (!Array.isArray(berichten) || berichten.length % 2) berichten = [];
let bezig = false;
const tekstVan = (b: Bericht) => (typeof b.content === 'string' ? b.content : b.content.filter((k) => k.type === 'text').map((k) => k.text).join(''));
/** Actielabels uit het antwoord halen; tijdens het binnenlopen ook een half label aan het eind. */
const zonderActie = (t: string) => t.replace(/\[\[[^\]]*\]\]/g, '').replace(/\[\[?[^\]]*$/, '').trim();
const ACTIE = /\[\[(label:(reviewplus|viewplus|websiteplus|tabplus)|demo|labels)\]\]/;

async function vraag(tekst: string): Promise<void> {
  const g = await laadGids();
  const vraagTekst = tekst.trim().slice(0, 1000);
  if (!vraagTekst || bezig) return;
  if (!g.zichtbaar) g.toon();
  // een lang gesprek begint stil opnieuw: in de ballon zie je toch alleen de laatste vraag
  if (berichten.length + 1 > MAX_BERICHTEN) berichten = [];
  const verzoek: Bericht[] = [...berichten, { role: 'user', content: vraagTekst }];
  const antwoord = g.vraag(vraagTekst);
  bezig = true;
  const mislukt = (soort: string) => { meld('fout'); g.zeg({ kop: vraagTekst, tekst: MELDINGEN[soort] ?? MELDINGEN.storing }); };
  try {
    const res = await fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ berichten: verzoek }) });
    if (!res.ok || !res.body) {
      const fout = (await res.json().catch(() => ({}))).fout ?? 'storing';
      if (fout === 'te-lang') berichten = [];
      mislukt(fout);
      return;
    }
    const lezer = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '', totNu = '', klaar = false;
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
          totNu += data.t;
          antwoord.stukje(zonderActie(totNu));
        } else if (data.klaar) {
          klaar = true;
          berichten = [...verzoek, { role: 'assistant', content: data.inhoud }];
          schrijf('session', GESPREK, berichten);
          meld('klaar');
          toonAntwoord(g, vraagTekst, tekstVan(berichten[berichten.length - 1]), data.over);
        } else if (data.fout) { mislukt(data.fout); return; }
      }
    }
    if (!klaar) mislukt('storing');
  } catch {
    mislukt('storing');
  } finally {
    bezig = false;
  }
}

function toonAntwoord(g: AioGids, vraagTekst: string, tekst: string, over: unknown): void {
  const actie = ACTIE.exec(tekst);
  let schoon = zonderActie(tekst);
  if (typeof over === 'number' && over <= 3) schoon += over === 0 ? '\n\nDit was je laatste vraag voor vandaag.' : `\n\nJe kunt vandaag nog ${over} ${over === 1 ? 'vraag' : 'vragen'} stellen.`;
  const knoppen: GidsKnop[] = [];
  if (actie?.[2]) { const id = actie[2] as LabelId; knoppen.push({ tekst: `Laat ${label(id).naam} zien`, soort: 'akkoord', doe: () => naarLabel(g, id, true) }); }
  else if (actie?.[1] === 'demo') knoppen.push({ tekst: 'Plan een demo', soort: 'akkoord', doe: () => naarDemo(g, true) });
  else if (actie?.[1] === 'labels') knoppen.push({ tekst: 'Laat de labels zien', soort: 'akkoord', doe: () => naarLabels(g, true) });
  g.zeg({ kop: vraagTekst, tekst: schoon, knoppen });
}

// ---------- menuknop en menuster ----------

menuKnop.addEventListener('click', async () => {
  const g = await laadGids();
  // zichtbaar met een dichte ballon (bijvoorbeeld na Escape): eerst de ballon weer open, pas daarna wegsturen
  if (g.zichtbaar && (g.ballonIsOpen || !g.heropen())) { g.verberg(); return; }
  if (g.zichtbaar) return;
  g.toon({ focus: true });
  groet(g, true);
});

/** De menuster (klein) laadt na de eerste interactie of na 5 s, zodat hij de laadfase van de pagina niet verzwaart. */
async function laadMenuster(): Promise<void> {
  const { maakAio } = await import('@/scripts/aio-wezen');
  maakAio(menuKnop, { grootte: 'klein' });
}
const inRust = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 300));
const EERSTE_INTERACTIE = ['pointermove', 'scroll', 'touchstart', 'keydown'] as const;
let menusterGestart = false;
const startMenuster = () => {
  if (menusterGestart) return;
  menusterGestart = true;
  EERSTE_INTERACTIE.forEach((e) => removeEventListener(e, startMenuster));
  inRust(() => void laadMenuster());
};
EERSTE_INTERACTIE.forEach((e) => addEventListener(e, startMenuster, { once: true, passive: true }));
setTimeout(startMenuster, 5000);

// AIO kleurt mee met het gekozen label (heelal.ts zet data-gekozen op het labelmenu); de menuknop gloeit in die kleur.
function volgLabel(): void {
  const id = labelMenu?.dataset.gekozen as LabelId | undefined;
  zetLabel(id ?? 'aio');
  menuKnop.style.setProperty('--aio-k', id ? label(id).kleur : 'rgb(255 228 196)');
}
if (labelMenu) new MutationObserver(volgLabel).observe(labelMenu, { attributes: true, attributeFilter: ['data-gekozen'] });

// ---------- meereizen: AIO vertelt per onderdeel kort wat je ziet ----------

/**
 * AIO komt vanzelf uit het menu zodra de bezoeker begint te scrollen (niet bij het laden, niet als hij eerder is
 * weggestuurd, niet bij prefers-reduced-motion). Elk onderdeel vertelt hij één keer per bezoek.
 */
const magVanzelf = () => beweging() && lees<string>('local', STAND, 'aan') !== 'uit';

let laatsteVertel = 0, laatsteGebruik = 0;
const gidsLaag = document.getElementById('aio-gids');
for (const e of ['pointerdown', 'keydown'] as const) gidsLaag?.addEventListener(e, () => { laatsteGebruik = Date.now(); });
menuKnop.addEventListener('click', () => { laatsteGebruik = Date.now(); });
const wachtrij = new Set<string>();
async function vertel(id: string, maak: (g: AioGids) => void): Promise<void> {
  if (!magVanzelf() && !gids?.zichtbaar) return;
  if (gezien.has(id) || bezig || wachtrij.has(id)) return;
  // is de bezoeker met AIO bezig (vraag, voorstel, rondleiding), dan praat AIO er niet doorheen
  if (Date.now() - laatsteGebruik < 20000 || gidsLaag?.matches(':focus-within')) return;
  // niet door elkaar heen praten: een nieuw onderwerp wacht tot het vorige even te lezen was
  const wacht = laatsteVertel + 4500 - Date.now();
  if (wacht > 0) {
    wachtrij.add(id);
    setTimeout(() => { wachtrij.delete(id); void vertel(id, maak); }, wacht);
    return;
  }
  laatsteVertel = Date.now();
  const g = await laadGids();
  if (!g.zichtbaar && !magVanzelf()) return;
  if (!eersteKeer(id)) return;
  if (!g.zichtbaar) g.toon();
  maak(g);
}

let welkomGedaan = false;
addEventListener('scroll', () => {
  if (!welkomGedaan && scrollY > innerHeight * .35) {
    welkomGedaan = true;
    void vertel('welkom', (g) => groet(g, false));
  }
  // het labelmenu staat helemaal in beeld aan het eind van de reis
  if (reis && !labelMenu?.dataset.gekozen && scrollY > reis.offsetTop + reis.offsetHeight - innerHeight * 1.12) {
    void vertel('labels', (g) => kiesLabel(g, 'Dit zijn de vier labels van AIO Plus. Waar ben je naar op zoek? Dan wijs ik je de weg.'));
  }
}, { passive: true });

// per label: bij het begin van het hoofdstuk en bij de afsluiting
const waarnemer = new IntersectionObserver((items) => {
  for (const e of items) {
    if (!e.isIntersecting) continue;
    const el = e.target as HTMLElement;
    const hoofdstuk = el.closest<HTMLElement>('[data-hoofdstuk]');
    const id = hoofdstuk?.dataset.hoofdstuk as LabelId | undefined;
    if (!id) continue;
    const l = label(id);
    if (el.classList.contains('h-slot')) {
      const knop = el.querySelector<HTMLAnchorElement>('a.knop');
      if (knop) {
        void vertel(`slot-${id}`, (g) => g.zeg({
          tekst: `Wil je verder met ${l.naam}? Dan wijs ik je de weg.`,
          ideeen: [
            { tekst: knop.textContent?.replace('→', '').trim() ?? l.naam, doe: () => stelVoor(g, knop, { knop: knop.textContent?.replace('→', '').trim() ?? '', wat: 'Dan ga je verder op die site.', klaar: 'De pagina gaat open.', focus: true }) },
            { tekst: 'Plan een demo', doe: () => naarDemo(g, true) },
            { tekst: 'Alle labels', doe: () => naarLabels(g, true) },
          ],
        }));
      }
    } else {
      void vertel(`label-${id}`, (g) => g.zeg({ tekst: `Dit is ${l.naam}. ${l.oms} Scroll verder: ik vertel onderweg wat het doet.`, vluchtig: true }));
    }
  }
}, { threshold: .55 });
document.querySelectorAll('[data-hoofdstuk] > .scene:first-child, [data-hoofdstuk] .h-slot').forEach((el) => waarnemer.observe(el));

volgLabel();
