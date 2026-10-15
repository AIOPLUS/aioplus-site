/**
 * AIO als gids: de grote ster komt uit de menuknop, zweeft mee terwijl je scrolt en praat in een ballon. Hij wijst
 * onderdelen aan ("klik hier") en kan na akkoord zelf klikken: dan vliegt hij erheen, port en klikt, zodat je ziet wat er
 * gebeurt. Wegklikken met het kruisje bij de ster of met de menuknop; dan vliegt hij terug in het menu.
 * Ontwerp en patronen: hub docs/agent/AIO-GIDS.md (Refero: Duolingo, Koji, Vimeo, Tango, n8n, Lovable).
 *
 * De gids weet niets van de pagina: de site (of app, of shop) bepaalt wat AIO zegt en welke knoppen er zijn.
 * Zonder WebGL of bij prefers-reduced-motion blijft de CSS-bol staan, zonder vliegen, meezweven of woord-voor-woord.
 * AIO voert nooit iets uit zonder klik op een akkoordknop (docs/agent/AIO-KARAKTER.md).
 */
// inline en pas bij het laden van de gids in de head: een gewone import zet Astro als blokkerende stylesheet op elke pagina
import gidsCss from './gids.css?inline';
import { huidigLabel, LABELKLEUR, meld, zetKijkdoel } from './brein';
import { maakAio } from './index';

export type GidsKnop = { tekst: string; soort?: 'akkoord' | 'gewoon'; doe: () => void };
export type GidsBericht = {
  /** Wat AIO zegt: korte alinea's; regels die met "- " beginnen worden een lijstje, links worden klikbaar. */
  tekst: string;
  /** Kleine kop boven de tekst, bijvoorbeeld "Stap 1 van 3" of de vraag van de bezoeker. */
  kop?: string;
  knoppen?: GidsKnop[];
  /** Voorgestelde vragen of keuzes als pillen. */
  ideeen?: GidsKnop[];
  /** Het element dat AIO aanwijst (gloed en pijl). */
  wijs?: Element | null;
  /** Gaat na een paar seconden vanzelf dicht als er niets mee gebeurt (vertellen tijdens het scrollen). */
  vluchtig?: boolean;
};
export type GidsOpties = {
  menuKnop: HTMLElement;
  /** De bezoeker typt een vraag. */
  opVraag: (vraag: string) => void;
  /** De gids gaat open of dicht (de site onthoudt dat). */
  opZichtbaar?: (aan: boolean) => void;
  plaatshouder?: string;
  /** Kleine regel onder het vraagveld, bijvoorbeeld dat AIO fouten kan maken. */
  noot?: string;
};

type Vec = { x: number; y: number };
const beweging = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const klem = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const maak = <K extends keyof HTMLElementTagNameMap>(tag: K, klasse: string, ouder?: HTMLElement): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  el.className = klasse;
  ouder?.append(el);
  return el;
};

/** Zet een tekst om in alinea's en lijstjes, met klikbare links. Nooit als HTML: alleen tekstknopen. */
export function opmaak(el: HTMLElement, tekst: string): void {
  el.replaceChildren();
  for (const blok of tekst.trim().split(/\n{2,}/)) {
    const regels = blok.split('\n').filter((r) => r.trim());
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

/** Laat de woorden van AIO een voor een verschijnen (alleen het beeld; schermlezers krijgen de hele tekst). */
function woordVoorWoord(el: HTMLElement): number {
  if (!beweging()) return 0;
  let i = 0;
  const loop = (n: Node) => {
    for (const kind of [...n.childNodes]) {
      if (kind.nodeType === Node.TEXT_NODE) {
        const delen = (kind.textContent ?? '').split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const deel of delen) {
          if (!deel.trim()) { frag.append(deel); continue; }
          const s = document.createElement('span');
          s.className = 'aio-woord';
          s.style.animationDelay = `${Math.min(i++ * 28, 1600)}ms`;
          s.textContent = deel;
          frag.append(s);
        }
        kind.replaceWith(frag);
      } else loop(kind);
    }
  };
  loop(el);
  return Math.min(i * .028, 1.6) + .3;
}

export class AioGids {
  zichtbaar = false;
  // de pagina mag een lege houder met id aio-gids hebben (zodat aria-controls van de menuknop klopt)
  private laag = (document.getElementById('aio-gids') as HTMLDivElement | null) ?? maak('div', 'aio-gids');
  private sterVak = maak('div', 'aio-gids-ster', this.laag);
  private lijf = maak('button', 'aio-gids-lijf', this.sterVak);
  private weg = maak('button', 'aio-gids-weg', this.sterVak);
  private ballon = maak('section', 'aio-gids-ballon', this.laag);
  private inhoud = maak('div', 'aio-gids-inhoud', this.ballon);
  private kop = maak('p', 'aio-gids-kop', this.inhoud);
  private tekst = maak('div', 'aio-gids-tekst', this.inhoud);
  private knoppen = maak('div', 'aio-gids-knoppen', this.inhoud);
  private ideeen = maak('div', 'aio-gids-ideeen', this.inhoud);
  private vorm = maak('form', 'aio-gids-vorm', this.ballon);
  private veld = maak('input', 'aio-gids-veld', this.vorm);
  private stuur = maak('button', 'aio-gids-stuur', this.vorm);
  private gloed = maak('div', 'aio-gids-gloed', this.laag);
  private pijl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private pijlLijn = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  private pijlPunt = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  private p: Vec = { x: 0, y: 0 };
  private v: Vec = { x: 0, y: 0 };
  private schaal = 1;
  private schaalV = 0;
  private doelSchaal = 1;
  private wijsEl: Element | null = null;
  private terugNaarMenu = false;
  private lusId = 0;
  private vorigeTijd = 0;
  private vorigeScroll = scrollY;
  private slepen: { id: number; start: Vec; vanaf: Vec; bewogen: boolean; laatst: Vec; t: number } | null = null;
  private ballonOpen = false;
  private dichtTimer = 0;
  private wijsTimer = 0;
  private ballonMaat = { b: 320, h: 120 };
  private sterGemaakt = false;
  private bezig: { stop: boolean } | null = null;
  /** Telt elk nieuw bericht: een antwoord dat nog binnenloopt, tekent niet over een nieuwer bericht heen. */
  private versie = 0;

  constructor(private opties: GidsOpties) {
    if (!document.getElementById('aio-gids-css')) {
      const stijl = document.createElement('style');
      stijl.id = 'aio-gids-css';
      stijl.textContent = gidsCss;
      document.head.append(stijl);
    }
    this.laag.hidden = true;
    this.laag.id = 'aio-gids';
    this.laag.className = 'aio-gids';
    this.sterVak.setAttribute('aria-hidden', 'true');
    this.lijf.type = 'button';
    this.lijf.tabIndex = -1;
    this.lijf.setAttribute('aria-hidden', 'true');
    this.weg.type = 'button';
    this.weg.textContent = '✕';
    this.weg.setAttribute('aria-label', 'AIO wegsturen');
    // het kruisje is de enige knop in de sterlaag die schermlezers en het toetsenbord moeten kennen
    this.sterVak.removeAttribute('aria-hidden');
    this.ballon.setAttribute('aria-label', 'AIO, je gids');
    this.tekst.setAttribute('aria-live', 'polite');
    this.kop.hidden = true;
    const label = maak('label', 'sr-only', this.vorm);
    label.htmlFor = 'aio-gids-vraag';
    label.textContent = 'Je vraag aan AIO';
    this.vorm.prepend(label);
    this.veld.id = 'aio-gids-vraag';
    this.veld.type = 'text';
    this.veld.maxLength = 1000;
    this.veld.autocomplete = 'off';
    this.veld.enterKeyHint = 'send';
    this.veld.placeholder = opties.plaatshouder ?? 'Vraag het AIO';
    this.stuur.type = 'submit';
    this.stuur.textContent = '↑';
    this.stuur.setAttribute('aria-label', 'Versturen');
    if (opties.noot) maak('p', 'aio-gids-noot', this.ballon).textContent = opties.noot;
    this.pijl.setAttribute('class', 'aio-gids-pijl');
    this.pijl.setAttribute('aria-hidden', 'true');
    this.pijlLijn.setAttribute('class', 'lijn');
    this.pijlPunt.setAttribute('class', 'punt');
    this.pijl.append(this.pijlLijn, this.pijlPunt);
    this.laag.prepend(this.pijl);
    document.body.append(this.laag);

    this.vorm.addEventListener('submit', (e) => {
      e.preventDefault();
      const vraag = this.veld.value.trim();
      if (!vraag) return;
      this.veld.value = '';
      opties.opVraag(vraag);
    });
    this.veld.addEventListener('input', () => meld('typt'));
    this.weg.addEventListener('click', () => this.verberg());
    this.ballon.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.klapIn(); this.opties.menuKnop.focus(); } });
    for (const e of ['pointerenter', 'focusin'] as const) this.ballon.addEventListener(e, () => clearTimeout(this.dichtTimer));
    new ResizeObserver(() => { this.ballonMaat = { b: this.ballon.offsetWidth, h: this.ballon.offsetHeight }; this.plaats(); }).observe(this.ballon);
    this.lijf.addEventListener('pointerdown', (e) => this.begin(e));
    addEventListener('pointermove', (e) => this.sleep(e), { passive: true });
    addEventListener('pointerup', (e) => this.los(e));
    addEventListener('pointercancel', (e) => this.los(e));
    addEventListener('scroll', () => {
      const dy = scrollY - this.vorigeScroll;
      this.vorigeScroll = scrollY;
      if (!this.zichtbaar || this.slepen || !beweging()) return;
      // meezweven: AIO blijft door zijn traagheid even achter en veert terug
      this.v.y = klem(this.v.y - dy * 5, -900, 900);
      this.start();
    }, { passive: true });
    addEventListener('resize', () => this.start());
  }

  // ---------- zichtbaar of niet ----------

  /** AIO komt uit de menuknop. focus: de bezoeker klikte zelf op de menuknop (zie focusStart). */
  toon({ focus = false } = {}): void {
    if (this.zichtbaar) { if (focus) this.focusStart(); return; }
    this.zichtbaar = true;
    this.terugNaarMenu = false;
    this.laag.hidden = false;
    this.laag.classList.remove('weg');
    this.opties.menuKnop.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('aio-gids-open');
    const m = this.menuMidden();
    this.p = { ...m };
    this.v = { x: -120, y: 260 };
    this.schaal = this.menuSchaal();
    this.doelSchaal = 1;
    if (!this.sterGemaakt) {
      this.sterGemaakt = true;
      maakAio(this.sterVak, { grootte: 'groot', invoer: this.veld });
    }
    if (!beweging()) { this.p = this.thuis(); this.schaal = 1; }
    meld('open');
    this.opties.opZichtbaar?.(true);
    this.start();
    if (focus) requestAnimationFrame(() => this.focusStart());
  }

  /**
   * Focus na een klik op de menuknop: met een muis het vraagveld; op een telefoon de eerste knop, zodat het toetsenbord
   * niet meteen half het scherm bedekt.
   */
  private focusStart(): void {
    if (matchMedia('(pointer: fine)').matches) { this.veld.focus({ preventScroll: true }); return; }
    (this.knoppen.querySelector('button') ?? this.ideeen.querySelector('button'))?.focus({ preventScroll: true });
  }

  get ballonIsOpen(): boolean { return this.ballonOpen; }

  /** Ballon weer open (menuknop of toetsenbord na Escape). false als AIO nog niets zei. */
  heropen(): boolean {
    if (!this.tekst.childNodes.length) return false;
    this.openBallon();
    requestAnimationFrame(() => this.focusStart());
    return true;
  }

  /** Telt de berichten: een voorstel weet zo of het nog het laatste woord van AIO is. */
  get berichtNr(): number { return this.versie; }

  /** AIO vliegt terug in de menuknop. */
  verberg(): void {
    if (!this.zichtbaar) return;
    this.zichtbaar = false;
    this.stopBezig();
    this.wijs(null);
    this.klapIn();
    this.opties.menuKnop.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('aio-gids-open');
    this.opties.opZichtbaar?.(false);
    if (this.laag.contains(document.activeElement)) this.opties.menuKnop.focus({ preventScroll: true });
    if (!beweging()) { this.laag.hidden = true; return; }
    this.terugNaarMenu = true;
    this.doelSchaal = this.menuSchaal();
    this.laag.classList.add('weg');
    this.start();
  }

  // ---------- praten ----------

  /** AIO zegt iets in de ballon (vervangt het vorige bericht). */
  zeg(b: GidsBericht): void {
    this.versie++;
    clearTimeout(this.dichtTimer);
    this.kop.hidden = !b.kop;
    this.kop.textContent = b.kop ?? '';
    opmaak(this.tekst, b.tekst);
    this.tekst.classList.remove('laadt');
    const duur = woordVoorWoord(this.tekst);
    meld('praat', duur);
    this.zetKnoppen(this.knoppen, b.knoppen ?? [], 'aio-gids-knop');
    this.zetKnoppen(this.ideeen, b.ideeen ?? [], 'aio-gids-idee');
    this.wijs(b.wijs ?? null);
    this.openBallon();
    if (b.vluchtig && !this.ballon.matches(':hover, :focus-within')) {
      this.dichtTimer = window.setTimeout(() => { if (!this.ballon.matches(':hover, :focus-within')) this.klapIn(); }, 9000 + duur * 1000);
    }
  }

  /** Een vraag van de bezoeker: toont de vraag en een wachtend antwoord; geeft functies om het antwoord binnen te laten lopen. */
  vraag(vraag: string): { stukje: (tekst: string) => void } {
    this.zeg({ kop: vraag, tekst: '' });
    const versie = this.versie;
    this.tekst.classList.add('laadt');
    meld('wacht');
    let gepland = false, totNu = '';
    return {
      stukje: (tekst: string) => {
        if (this.versie !== versie) return;
        totNu = tekst;
        this.tekst.classList.remove('laadt');
        meld('praat');
        if (gepland) return;
        gepland = true;
        requestAnimationFrame(() => { gepland = false; if (this.versie === versie) opmaak(this.tekst, totNu); });
      },
    };
  }

  private zetKnoppen(houder: HTMLElement, knoppen: GidsKnop[], klasse: string): void {
    houder.replaceChildren(...knoppen.map((k) => {
      const b = maak('button', `${klasse}${k.soort === 'akkoord' ? ' akkoord' : ''}`);
      b.type = 'button';
      b.textContent = k.tekst;
      b.addEventListener('click', () => k.doe());
      return b;
    }));
    houder.hidden = !knoppen.length;
  }

  private openBallon(): void {
    this.ballonOpen = true;
    this.ballon.classList.add('open');
    this.lijf.setAttribute('aria-expanded', 'true');
    this.start();
  }

  klapIn(): void {
    clearTimeout(this.dichtTimer);
    this.ballonOpen = false;
    this.ballon.classList.remove('open');
    if (!this.bezig) this.wijs(null);
  }

  /** Focus op de eerste akkoordknop (na een keuze van de bezoeker, zodat het ook met het toetsenbord vlot gaat). */
  focusKnop(): void {
    this.knoppen.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }

  // ---------- aanwijzen en doen ----------

  /** Wijs een element aan: AIO vliegt ernaast, kijkt ernaar, met een gloed en een pijl. null = terug naar zijn plek. */
  wijs(el: Element | null): void {
    this.wijsEl = el;
    zetKijkdoel(el);
    // aanwijzen houdt de lus en de grote ster op volle snelheid: na 30 s zonder vervolg stopt het (batterij)
    clearTimeout(this.wijsTimer);
    if (el) this.wijsTimer = window.setTimeout(() => { if (!this.bezig && this.wijsEl === el) this.wijs(null); }, 30_000);
    this.gloed.classList.toggle('aan', Boolean(el));
    this.pijl.classList.toggle('aan', Boolean(el));
    if (el) this.gloed.style.setProperty('--gk', this.labelKleur());
    this.start();
  }

  /**
   * AIO doet het zelf (na akkoord): vliegt naar het element, port en klikt erop. Zichtbaar bezig met een stopknop.
   * Geeft false als de bezoeker op stop klikte.
   */
  async doe(el: HTMLElement, bezigTekst: string): Promise<boolean> {
    this.stopBezig();
    const bezig = { stop: false };
    this.bezig = bezig;
    if (!this.inBeeld(el)) el.scrollIntoView({ block: 'center', behavior: beweging() ? 'smooth' : 'auto' });
    this.zeg({ tekst: bezigTekst, knoppen: [{ tekst: 'Stop', doe: () => { bezig.stop = true; } }], wijs: el });
    this.ballon.classList.add('werkt');
    await new Promise((r) => setTimeout(r, beweging() ? 1100 : 300));
    this.ballon.classList.remove('werkt');
    if (bezig.stop || this.bezig !== bezig) { if (this.bezig === bezig) this.bezig = null; this.wijs(null); return false; }
    this.bezig = null;
    this.gloed.classList.add('klik');
    setTimeout(() => this.gloed.classList.remove('klik'), 500);
    meld('por');
    el.click();
    meld('actie');
    return true;
  }

  private stopBezig(): void {
    if (this.bezig) this.bezig.stop = true;
    this.bezig = null;
    this.ballon.classList.remove('werkt');
  }

  // ---------- slepen en porren ----------

  private begin(e: PointerEvent): void {
    if (this.slepen || !this.zichtbaar) return;
    this.slepen = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, vanaf: { ...this.p }, bewogen: false, laatst: { x: e.clientX, y: e.clientY }, t: performance.now() };
  }

  private sleep(e: PointerEvent): void {
    const s = this.slepen;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.start.x, dy = e.clientY - s.start.y;
    if (!s.bewogen && Math.hypot(dx, dy) < 6) return;
    s.bewogen = true;
    const nu = performance.now(), dt = Math.max(1, nu - s.t) / 1000;
    this.v = { x: (e.clientX - s.laatst.x) / dt, y: (e.clientY - s.laatst.y) / dt };
    s.laatst = { x: e.clientX, y: e.clientY };
    s.t = nu;
    this.p = { x: s.vanaf.x + dx, y: s.vanaf.y + dy };
    this.start();
  }

  private los(e: PointerEvent): void {
    const s = this.slepen;
    if (!s || e.pointerId !== s.id) return;
    this.slepen = null;
    meld('por');
    if (s.bewogen) { this.v = { x: klem(this.v.x, -2500, 2500), y: klem(this.v.y, -2500, 2500) }; this.start(); return; }
    // klikken op AIO: de ballon open of dicht
    if (this.ballonOpen) this.klapIn();
    else if (this.tekst.childNodes.length) this.openBallon();
    else this.zeg({ tekst: 'Vraag me gerust iets, of scroll verder: ik vertel onderweg wat je ziet.' });
  }

  // ---------- plaats en beweging ----------

  private straal(): number { return this.sterVak.offsetWidth * .2; }

  private menuMidden(): Vec {
    const r = this.opties.menuKnop.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  private menuSchaal(): number { return Math.max(.2, this.opties.menuKnop.offsetWidth / (2 * this.straal())); }

  private thuis(): Vec {
    const R = this.straal(), rand = innerWidth < 640 ? 14 : 26;
    return { x: innerWidth - rand - R, y: innerHeight - rand - R };
  }

  private inBeeld(el: Element): boolean {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }

  /** Waar AIO heen gaat als hij iets aanwijst: ernaast, eronder of erboven, anders in de hoek van het element. */
  private naast(el: Element): Vec {
    const r = el.getBoundingClientRect(), R = this.straal(), m = 14, W = innerWidth, H = innerHeight;
    const y = klem(r.top + r.height / 2, R + m, H - R - m);
    if (r.bottom < 120) return { x: klem(r.left + r.width / 2 + R * 1.6, R + m, W - R - m), y: r.bottom + R + 22 };
    if (r.right + 2 * R + 2 * m < W) return { x: r.right + R + m, y };
    if (r.left - 2 * R - 2 * m > 0) return { x: r.left - R - m, y };
    if (r.bottom + 2 * R + 2 * m < H) return { x: klem(r.left + r.width / 2, R + m, W - R - m), y: r.bottom + R + m };
    if (r.top - 2 * R - 2 * m > 0) return { x: klem(r.left + r.width / 2, R + m, W - R - m), y: r.top - R - m };
    return { x: klem(r.right - R - m, R + m, W - R - m), y: klem(r.bottom - R - m, R + m, H - R - m) };
  }

  private doel(): Vec {
    if (this.terugNaarMenu) return this.menuMidden();
    if (this.wijsEl?.isConnected && this.inBeeld(this.wijsEl)) return this.naast(this.wijsEl);
    return this.thuis();
  }

  private start(): void {
    if (this.lusId || this.laag.hidden) return;
    this.vorigeTijd = performance.now();
    this.lusId = requestAnimationFrame((t) => this.stap(t));
  }

  private stap(t: number): void {
    this.lusId = 0;
    const dt = Math.min(.04, (t - this.vorigeTijd) / 1000 || .016);
    this.vorigeTijd = t;
    const T = this.doel();
    if (!this.slepen) {
      if (beweging()) {
        // veer met een beetje doorschieten: levend, niet mechanisch
        const k = this.terugNaarMenu ? 120 : 70, c = 2 * Math.sqrt(k) * .72;
        this.v.x += ((T.x - this.p.x) * k - this.v.x * c) * dt;
        this.v.y += ((T.y - this.p.y) * k - this.v.y * c) * dt;
        this.p.x += this.v.x * dt;
        this.p.y += this.v.y * dt;
        this.schaalV += ((this.doelSchaal - this.schaal) * 140 - this.schaalV * 2 * Math.sqrt(140) * .8) * dt;
        this.schaal += this.schaalV * dt;
      } else { this.p = { ...T }; this.v = { x: 0, y: 0 }; this.schaal = this.doelSchaal; }
    }
    this.plaats();
    const rust = Math.hypot(T.x - this.p.x, T.y - this.p.y) < .5 && Math.hypot(this.v.x, this.v.y) < 2 && Math.abs(this.doelSchaal - this.schaal) < .002;
    if (this.terugNaarMenu && Math.hypot(T.x - this.p.x, T.y - this.p.y) < 10) {
      this.terugNaarMenu = false;
      this.laag.hidden = true;
      return;
    }
    // blijf tekenen zolang hij beweegt of iets aanwijst (het element kan meescrollen)
    if (!rust || this.wijsEl || this.slepen) this.lusId = requestAnimationFrame((t2) => this.stap(t2));
  }

  /** Zet de ster, de ballon, de gloed en de pijl op hun plek. */
  private plaats(): void {
    const { x, y } = this.p, R = this.straal(), W = innerWidth, H = innerHeight;
    const kant = this.sterVak.offsetWidth / 2;
    const kantel = beweging() ? klem(this.v.x * .012, -12, 12) : 0;
    const rek = beweging() ? klem(Math.hypot(this.v.x, this.v.y) / 9000, 0, .07) : 0;
    this.sterVak.style.transform = `translate3d(${x - kant}px, ${y - kant}px, 0) rotate(${kantel}deg) scale(${this.schaal * (1 - rek * .5)}, ${this.schaal * (1 + rek)})`;

    // ballon: naast de ster, naar het midden van het scherm toe; op een smal scherm erboven of eronder
    const { b, h } = this.ballonMaat, m = 16, afstand = R * this.schaal + 12;
    let bx: number, by: number, kantB: string;
    if (W < 640) {
      // rechts uitgelijnd boven of onder de ster (op een telefoon is de ballon bijna schermbreed)
      bx = x + R - b + 22;
      if (y > H / 2) { by = y - afstand - h; kantB = 'onder'; } else { by = y + afstand; kantB = 'boven'; }
      this.ballon.style.setProperty('--staart', `${klem(x - bx, 24, W - 2 * m - 24)}px`);
    } else {
      if (x > W / 2) { bx = x - afstand - b; kantB = 'rechts'; } else { bx = x + afstand; kantB = 'links'; }
      by = klem(y - h + R * .7, m, H - h - m);
      this.ballon.style.setProperty('--staart', `${klem(y - by, 20, h - 20)}px`);
    }
    bx = klem(bx, m, W - b - m);
    by = klem(by, m, Math.max(m, H - h - m));
    this.ballon.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
    this.ballon.dataset.kant = kantB;

    // gloed en pijl naar het aangewezen element
    const el = this.wijsEl;
    if (el?.isConnected) {
      const r = el.getBoundingClientRect(), pad = 6;
      const rond = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8;
      Object.assign(this.gloed.style, { transform: `translate3d(${r.left - pad}px, ${r.top - pad}px, 0)`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px`, borderRadius: `${rond + pad}px` });
      const doelX = klem(x, r.left - pad, r.right + pad), doelY = klem(y, r.top - pad, r.bottom + pad);
      const dx = doelX - x, dy = doelY - y, d = Math.hypot(dx, dy);
      if (d > R * this.schaal + 26) {
        const ux = dx / d, uy = dy / d;
        const sx = x + ux * (R * this.schaal + 8), sy = y + uy * (R * this.schaal + 8);
        const ex = doelX - ux * 6, ey = doelY - uy * 6;
        const bocht = Math.min(60, d * .25);
        const cx = (sx + ex) / 2 - uy * bocht, cy = (sy + ey) / 2 + ux * bocht;
        this.pijlLijn.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
        // pijlpunt in de richting van het laatste stuk van de bocht
        const hx = ex - cx, hy = ey - cy, hl = Math.hypot(hx, hy) || 1, px = hx / hl, py = hy / hl, L = 10;
        this.pijlPunt.setAttribute('d', `M${(ex - px * L - py * L * .6).toFixed(1)},${(ey - py * L + px * L * .6).toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)} L${(ex - px * L + py * L * .6).toFixed(1)},${(ey - py * L - px * L * .6).toFixed(1)}`);
        this.pijl.classList.add('aan');
      } else this.pijl.classList.remove('aan');
    }
  }

  private labelKleur(): string {
    const l = huidigLabel();
    return l === 'aio' ? '#ffd9ae' : `#${LABELKLEUR[l].toString(16).padStart(6, '0')}`;
  }
}
