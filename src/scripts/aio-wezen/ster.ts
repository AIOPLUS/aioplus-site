/**
 * AIO als ster op een canvas. Klein (menuknop, chatkop): lijf met hart en ogen, zonder korrels en corona.
 * Groot (chatvenster): met kokend oppervlak, corona en vonken. Alle sterren delen één brein en één tekenlus;
 * een ster die niet in beeld is (of in een gesloten venster staat) tekent niet.
 */
import * as THREE from 'three';
import { coronaFragment, lijfFragment, lijfVertex, vlakVertex, vonkFragment, vonkVertex } from './shaders';
import { huidigLabel, LABELKLEUR, meld, stap, stemming, volgActiviteit, type AioLabel } from './brein';

export type AioOpties = {
  grootte: 'klein' | 'groot';
  /** Op een lichte achtergrond krijgt de ster een donkerdere amberrand. */
  achtergrond?: 'donker' | 'licht';
  /** Waar AIO naar kijkt als hij luistert (bijvoorbeeld het invoerveld). */
  invoer?: HTMLElement;
  /** Klikken op de ster = porren. */
  porren?: boolean;
};

const VIER = [LABELKLEUR.reviewplus, LABELKLEUR.viewplus, LABELKLEUR.websiteplus, LABELKLEUR.tabplus];
const v3 = (hex: number) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
const FOV = 30, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
// Klein (34–40 px) is een grovere bol genoeg: minder werk bij het opstarten en per beeld.
const bollen: Partial<Record<'klein' | 'groot', THREE.SphereGeometry>> = {};
const bolVoor = (g: 'klein' | 'groot') => (bollen[g] ??= g === 'klein' ? new THREE.SphereGeometry(1, 48, 32) : new THREE.SphereGeometry(1, 128, 96));
/** Kleine sterren tekenen op ongeveer 30 beelden per seconde: op 40 px zie je geen verschil, de batterij wel. */
const KLEIN_INTERVAL = 1 / 31;

// ---------- gedeelde lus ----------
const sterren = new Set<AioSter>();
const muis = { x: 0, y: 0, actief: false };
let lusId = 0, vorige = 0, tijd = 0;

function lus(ms: number): void {
  const dt = Math.min(.05, (ms - vorige) / 1000 || .016);
  vorige = ms; tijd += dt;
  stap(tijd, dt);
  for (const s of sterren) s.teken(tijd, dt);
  lusId = sterren.size && !document.hidden ? requestAnimationFrame(lus) : 0;
}
function start(): void { if (!lusId && sterren.size && !document.hidden) { vorige = performance.now(); lusId = requestAnimationFrame(lus); } }
let lusKlaar = false;
function zetLusKlaar(): void {
  if (lusKlaar) return;
  lusKlaar = true;
  document.addEventListener('visibilitychange', start);
  addEventListener('pointermove', (e) => { muis.x = e.clientX; muis.y = e.clientY; muis.actief = true; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { muis.actief = false; });
  volgActiviteit();
}

export class AioSter {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, .1, 60);
  private lijf: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private corona: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private vonken: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private u: Record<string, THREE.IUniform>;
  private inBeeld = true;
  private kijk = new THREE.Vector3(0, 0, 1);
  private vonkLabel: AioLabel | null = null;
  private opgespaard = 0;
  private waarnemer: IntersectionObserver;
  private maat: ResizeObserver;
  private readonly groot: boolean;
  /** Deel van de canvashoogte dat de ster vult. */
  private readonly vulling: number;

  constructor(private canvas: HTMLCanvasElement, private opties: AioOpties) {
    this.groot = opties.grootte === 'groot';
    this.vulling = this.groot ? .4 : .9;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: this.groot ? 'default' : 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.groot ? Math.min(2, devicePixelRatio || 1) : Math.min(3, Math.max(2, devicePixelRatio || 1)));
    this.camera.position.z = 1 / (this.vulling * TAN);

    this.u = {
      uTijd: { value: 0 }, uOgen: { value: 1 }, uBlij: { value: 0 }, uLach: { value: .25 }, uMond: { value: 0 },
      uGloed: { value: 1 }, uWervel: { value: .15 }, uDim: { value: 0 }, uAccent: { value: 0 }, uVeel: { value: 1 },
      uLicht: { value: opties.achtergrond === 'licht' ? 1 : 0 },
      uFace: { value: new THREE.Vector3(0, 0, 1) }, uKleur: { value: v3(0xffe6c8) },
      uC1: { value: v3(VIER[0]) }, uC2: { value: v3(VIER[1]) }, uC3: { value: v3(VIER[2]) }, uC4: { value: v3(VIER[3]) },
      uCamObj: { value: new THREE.Vector3() },
    };
    this.lijf = new THREE.Mesh(bolVoor(opties.grootte), new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: lijfVertex, fragmentShader: lijfFragment, defines: this.groot ? {} : { KLEIN: 1 },
    }));
    this.scene.add(this.lijf);
    if (this.groot) this.maakCoronaEnVonken();

    this.waarnemer = new IntersectionObserver(([e]) => { this.inBeeld = e.isIntersecting; if (this.inBeeld) start(); });
    this.waarnemer.observe(canvas);
    this.maat = new ResizeObserver(() => this.pasMaatAan());
    this.maat.observe(canvas);
    this.pasMaatAan();
    canvas.addEventListener('webglcontextlost', () => this.stop());
    if (opties.porren) canvas.addEventListener('pointerdown', () => meld('por'));

    zetLusKlaar();
    sterren.add(this);
    start();
  }

  private maakCoronaEnVonken(): void {
    const MAAT = 7;
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(MAAT, MAAT), new THREE.ShaderMaterial({
      uniforms: { uTijd: { value: 0 }, uSterkte: { value: 1 }, uMaat: { value: MAAT }, uRand: { value: 1 / this.vulling }, uKleur: { value: v3(0xffd6a8) }, uTint: { value: v3(0xffb070) } },
      vertexShader: vlakVertex, fragmentShader: coronaFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    }));
    this.corona.renderOrder = -1;
    this.scene.add(this.corona);

    const N = 70, pos = new Float32Array(N * 3), fase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 1.18 + Math.pow(Math.random(), 1.6) * 1.1, a = Math.random() * Math.PI * 2, y = (Math.random() - .5) * 1.3;
      pos.set([Math.cos(a) * r, y * r * .55, Math.sin(a) * r], i * 3);
      fase[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
    geo.setAttribute('aKleur', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.vonken = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { uTijd: { value: 0 }, uGrootte: { value: 10 }, uSterkte: { value: 1 } }, vertexShader: vonkVertex, fragmentShader: vonkFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    }));
    this.scene.add(this.vonken);
  }

  private kleurVonken(label: AioLabel): void {
    if (!this.vonken) return;
    const kl = this.vonken.geometry.getAttribute('aKleur') as THREE.BufferAttribute;
    const warm = v3(0xffe2bf), wit = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < kl.count; i++) {
      const hex = label === 'aio' ? VIER[i % 4] : LABELKLEUR[label];
      const k = i % 3 === 0 ? warm : warm.clone().lerp(v3(hex).lerp(wit, .25), .85);
      kl.setXYZ(i, k.x, k.y, k.z);
    }
    kl.needsUpdate = true;
    this.vonkLabel = label;
  }

  private pasMaatAan(): void {
    // clientWidth: de maat zonder transform (het chatvenster schaalt bij het openen even van 96% naar 100%)
    const breed = this.canvas.clientWidth, hoog = this.canvas.clientHeight;
    if (!breed || !hoog) return;
    this.renderer.setSize(breed, hoog, false);
    this.camera.aspect = breed / hoog;
    this.camera.updateProjectionMatrix();
    if (this.vonken) {
      // vonkgrootte in pixels, in verhouding tot de straal van de ster op het scherm
      const straalPx = hoog * this.vulling / 2 * this.renderer.getPixelRatio();
      this.vonken.material.uniforms.uGrootte.value = .083 * straalPx * this.camera.position.z;
    }
  }

  /** Waar kijkt AIO naar: invoerveld, omhoog (denken), omlaag (slapen), de muis of rondkijken. */
  private kijkdoel(tijd: number): THREE.Vector3 {
    const s = stemming.staat;
    const r = this.canvas.getBoundingClientRect();
    const naar = (x: number, y: number) => {
      const bereik = Math.max(innerWidth, innerHeight) * .35;
      return new THREE.Vector3(THREE.MathUtils.clamp((x - (r.left + r.width / 2)) / bereik, -.45, .45), THREE.MathUtils.clamp(-(y - (r.top + r.height / 2)) / bereik, -.4, .4), 1);
    };
    if (s === 'luistert' && this.opties.invoer) { const i = this.opties.invoer.getBoundingClientRect(); return naar(i.left + i.width * .3, i.top + i.height / 2); }
    if (s === 'denkt') return new THREE.Vector3(.3, .38, 1);
    if (s === 'slaapt' || s === 'doezelt') return new THREE.Vector3(0, -.25, 1);
    if (muis.actief) return naar(muis.x, muis.y);
    return new THREE.Vector3(Math.sin(tijd * .35) * .18, Math.sin(tijd * .23) * .08, 1);
  }

  teken(tijd: number, dt: number): void {
    if (!this.inBeeld || !this.canvas.getClientRects().length) return;
    if (!this.groot) {
      this.opgespaard += dt;
      if (this.opgespaard < KLEIN_INTERVAL) return;
      dt = this.opgespaard;
      this.opgespaard = 0;
    }
    const s = stemming;
    const label = huidigLabel();
    if (this.vonken && label !== this.vonkLabel) this.kleurVonken(label);
    const u = this.u;
    u.uTijd.value = tijd; u.uOgen.value = s.ogenNu; u.uBlij.value = s.blij; u.uLach.value = s.lach; u.uMond.value = s.mondNu;
    u.uGloed.value = s.gloed; u.uWervel.value = s.wervel; u.uDim.value = s.dim; u.uAccent.value = s.accent; u.uVeel.value = s.veel;
    (u.uKleur.value as THREE.Vector3).set(...s.kleur);
    this.kijk.lerp(this.kijkdoel(tijd).normalize(), 1 - Math.exp(-dt * 9));
    (u.uFace.value as THREE.Vector3).copy(this.kijk).normalize();

    const q = s.knijp * (this.groot ? 1 : .3);
    const adem = Math.sin(tijd * (s.staat === 'slaapt' ? 1.1 : 1.8)) * (s.staat === 'slaapt' ? .025 : .012) * (this.groot ? 1 : .4);
    this.lijf.scale.set(1 + q + adem, 1 - q + adem, 1 + q * .5);
    this.lijf.position.y = s.wip * (this.groot ? 1 : .25);
    if (this.corona) {
      this.corona.position.y = this.lijf.position.y;
      const cu = this.corona.material.uniforms;
      cu.uTijd.value = tijd;
      cu.uSterkte.value = (.55 + .45 * s.gloed) * (1 - s.dim * .7);
      (cu.uTint.value as THREE.Vector3).copy(v3(0xffb070).lerp(new THREE.Vector3(...s.kleur), s.accent * .55));
    }
    if (this.vonken) {
      this.vonken.material.uniforms.uTijd.value = tijd;
      this.vonken.material.uniforms.uSterkte.value = (.5 + .5 * s.gloed) * (1 - s.dim * .8);
      this.vonken.rotation.y = tijd * .06;
    }
    this.lijf.updateMatrixWorld();
    (u.uCamObj.value as THREE.Vector3).copy(this.camera.position).applyMatrix4(this.lijf.matrixWorld.clone().invert());
    this.renderer.render(this.scene, this.camera);
  }

  stop(): void {
    sterren.delete(this);
    this.waarnemer.disconnect();
    this.maat.disconnect();
    this.lijf.material.dispose();
    this.corona?.geometry.dispose(); this.corona?.material.dispose();
    this.vonken?.geometry.dispose(); this.vonken?.material.dispose();
    this.renderer.dispose();
    this.canvas.dispatchEvent(new CustomEvent('aio-ster-weg', { bubbles: true }));
  }
}
