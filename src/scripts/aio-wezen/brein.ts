/**
 * Het brein van AIO: er is maar één AIO, ook als hij op meer plekken tegelijk staat (menuknop, chat, de gids).
 * Gebeurtenissen (typen, wachten op Claude, antwoord, fout, porren) en stilte bepalen de staat; elke ster op de pagina
 * leest zijn stemming hier. Staten en gedrag: hub docs/agent/AIO-KARAKTER.md.
 */

export type AioLabel = 'aio' | 'reviewplus' | 'viewplus' | 'websiteplus' | 'tabplus';
export type AioStaat = 'rust' | 'aandacht' | 'luistert' | 'denkt' | 'praat' | 'blij' | 'oeps' | 'doezelt' | 'slaapt';
/** typt: gebruiker typt · wacht: vraag verstuurd · praat: antwoord stroomt binnen · klaar: antwoord compleet ·
 *  fout: iets ging mis of geweigerd · actie: actie uitgevoerd (app) · por: klik op AIO · open: chat geopend */
export type AioGebeurtenis = 'typt' | 'wacht' | 'praat' | 'klaar' | 'fout' | 'actie' | 'por' | 'open';

/** Labelkleuren (merk), niet de lichtere varianten van de website. */
export const LABELKLEUR: Record<Exclude<AioLabel, 'aio'>, number> = {
  reviewplus: 0x1818ff,
  viewplus: 0x7a01b0,
  websiteplus: 0xff5722,
  tabplus: 0x14893f,
};

type Doel = { ogen: number; blij: number; lach: number; mond: number; gloed: number; wervel: number; dim: number };
const DOEL: Record<AioStaat, Doel> = {
  rust:     { ogen: 1,    blij: 0, lach: .25, mond: 0,   gloed: 1,    wervel: .15, dim: 0 },
  aandacht: { ogen: 1.12, blij: 0, lach: .45, mond: 0,   gloed: 1.15, wervel: .2,  dim: 0 },
  luistert: { ogen: 1.12, blij: 0, lach: .2,  mond: 0,   gloed: 1.25, wervel: .3,  dim: 0 },
  denkt:    { ogen: .5,   blij: 0, lach: 0,   mond: 0,   gloed: 1.15, wervel: 1,   dim: 0 },
  praat:    { ogen: 1,    blij: 0, lach: .25, mond: 1,   gloed: 1.2,  wervel: .35, dim: 0 },
  blij:     { ogen: 1,    blij: 1, lach: 1,   mond: 0,   gloed: 1.5,  wervel: .5,  dim: 0 },
  oeps:     { ogen: 1.28, blij: 0, lach: -.6, mond: .45, gloed: .75,  wervel: .1,  dim: .12 },
  doezelt:  { ogen: .4,   blij: 0, lach: .1,  mond: 0,   gloed: .7,   wervel: .05, dim: .25 },
  slaapt:   { ogen: 0,    blij: 0, lach: 0,   mond: 0,   gloed: .45,  wervel: .05, dim: .5 },
};

/** Wat elke ster per beeld gebruikt (zacht naar het doel van de staat). */
export type Stemming = Doel & { staat: AioStaat; ogenNu: number; mondNu: number; accent: number; veel: number; kleur: [number, number, number]; knijp: number; wip: number };

const DOEZEL_NA = 40, SLAAP_NA = 55;
const nu = () => performance.now() / 1000;
const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

let label: AioLabel = 'aio';
let laatsteActiviteit = nu();
let laatsteToets = -99, laatsteStukje = -99, wacht = false;
let tijdelijk: { staat: AioStaat; tot: number; daarna?: AioStaat } | null = null;
let pors: number[] = [];
let knijpV = 0;

export const stemming: Stemming = {
  ...DOEL.rust, staat: 'rust', ogenNu: 1, mondNu: 0, accent: 0, veel: 1, kleur: rgb(0xffe6c8), knijp: 0, wip: 0,
};
let knipper = 1, volgendeKnipper = 2.5;

function activiteit(): void {
  const t = nu();
  if (t - laatsteActiviteit > SLAAP_NA) tijdelijk = { staat: 'oeps', tot: t + .5, daarna: 'blij' };
  laatsteActiviteit = t;
}

/**
 * Meld een gebeurtenis aan AIO. Bij 'praat' zonder stroom (het hele antwoord komt in één keer) geeft duur in seconden
 * aan hoe lang AIO praat; meld daarna 'klaar'.
 */
export function meld(g: AioGebeurtenis, duur = 0): void {
  const t = nu();
  activiteit();
  switch (g) {
    case 'typt': laatsteToets = t; break;
    case 'wacht': wacht = true; break;
    case 'praat': wacht = false; laatsteStukje = t + duur; break;
    case 'klaar': wacht = false; laatsteStukje = -99; tijdelijk = { staat: 'blij', tot: t + 1.2 }; break;
    case 'fout': wacht = false; laatsteStukje = -99; tijdelijk = { staat: 'oeps', tot: t + 1.3 }; break;
    case 'actie': tijdelijk = { staat: 'blij', tot: t + 1.6 }; knijpV += 5; break;
    case 'open': tijdelijk = { staat: 'aandacht', tot: t + 1.2 }; break;
    case 'por':
      knijpV += 7;
      pors = pors.filter((x) => t - x < 1.6); pors.push(t);
      tijdelijk = pors.length >= 4 ? { staat: 'oeps', tot: t + 1.2 } : { staat: 'blij', tot: t + .9 };
      break;
  }
}

export const huidigLabel = (): AioLabel => label;

/** Waar AIO naar kijkt als hij iets aanwijst (de gids); null = de muis of rondkijken. */
let kijkdoel: Element | null = null;
export const huidigKijkdoel = (): Element | null => kijkdoel;
export function zetKijkdoel(el: Element | null): void {
  kijkdoel = el;
  if (el) activiteit();
}

/** Zet het label waar de gebruiker is ('aio' = alle labels samen). */
export function zetLabel(l: AioLabel, stil = false): void {
  if (l === label) return;
  label = l;
  // stil: bij het laden van een pagina meteen de goede kleur, zonder blij op te springen
  if (stil) { const hex = l === 'aio' ? null : LABELKLEUR[l]; stemming.accent = hex === null ? 0 : 1; stemming.veel = hex === null ? 1 : 0; if (hex !== null) stemming.kleur = rgb(hex); return; }
  knijpV += 4;
  tijdelijk = { staat: 'blij', tot: nu() + 1 };
}

/** Elke beweging, toets of scroll houdt AIO wakker. */
let luistertNaarActiviteit = false;
export function volgActiviteit(): void {
  if (luistertNaarActiviteit) return;
  luistertNaarActiviteit = true;
  for (const e of ['pointermove', 'keydown', 'scroll', 'touchstart'] as const) addEventListener(e, activiteit, { passive: true });
}

function kiesStaat(t: number): AioStaat {
  if (tijdelijk && t < tijdelijk.tot) return tijdelijk.staat;
  if (tijdelijk?.daarna && t < tijdelijk.tot + 1) return tijdelijk.daarna;
  tijdelijk = null;
  if (wacht) return 'denkt';
  if (t - laatsteStukje < .6) return 'praat';
  if (t - laatsteToets < 1.4) return 'luistert';
  const stil = t - laatsteActiviteit;
  if (stil > SLAAP_NA) return 'slaapt';
  if (stil > DOEZEL_NA) return 'doezelt';
  return 'rust';
}

/** Eén stap per beeld; de lus in ster.ts roept dit één keer per beeld aan, voor alle sterren samen. */
export function stap(tijd: number, dt: number): void {
  const s = stemming;
  const staat = kiesStaat(nu());
  // ook als attribuut op <html>, zodat opmaak en tests de staat kunnen lezen
  if (staat !== s.staat && typeof document !== 'undefined') document.documentElement.dataset.aioStaat = staat;
  s.staat = staat;
  const doel = DOEL[staat];
  const k = 1 - Math.exp(-dt * (staat === 'oeps' ? 14 : 6));
  for (const key of Object.keys(doel) as (keyof Doel)[]) s[key] += (doel[key] - s[key]) * k;
  const kk = 1 - Math.exp(-dt * 3);
  const hex = label === 'aio' ? null : LABELKLEUR[label];
  s.accent += ((hex === null ? 0 : 1) - s.accent) * kk;
  s.veel += ((hex === null ? 1 : 0) - s.veel) * kk;
  if (hex !== null) { const d = rgb(hex); for (let i = 0; i < 3; i++) s.kleur[i] += (d[i] - s.kleur[i]) * kk; }
  // knipperen (niet in slaap), praten met de mond
  volgendeKnipper -= dt;
  if (volgendeKnipper <= 0 && staat !== 'slaapt') { knipper = 0; volgendeKnipper = (staat === 'doezelt' ? 1.2 : 2.2) + Math.random() * 3.5; }
  knipper = Math.min(1, knipper + dt * (staat === 'doezelt' ? 2.5 : 7));
  s.ogenNu = Math.max(0, s.ogen * (knipper < 1 ? Math.abs(knipper * 2 - 1) : 1));
  s.mondNu = staat === 'praat' ? s.mond * (.3 + .7 * Math.abs(Math.sin(tijd * 10) * Math.sin(tijd * 3.7 + .6))) : s.mond;
  // knijpen als een veer (porren), opwippen als hij blij is
  knijpV += (-s.knijp * 160 - knijpV * 9) * dt;
  s.knijp = Math.max(-.3, Math.min(.3, s.knijp + knijpV * dt));
  s.wip = staat !== 'blij' ? s.wip * (1 - k) : Math.abs(Math.sin(tijd * 7)) * .1;
}
