/**
 * Het heelal van aioplus.ai: een sterrenstelsel met vier armen in de labelkleuren (AIO in het midden),
 * dat bij het scrollen uiteenvalt en zich opnieuw ordent in het labelmenu (vier kwarten).
 * Eén WebGL-doek met Three.js; alle beweging gebeurt in de shader. Werkt ook zonder WebGL en met minder beweging.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Euler, MathUtils, Matrix3, Matrix4, PerspectiveCamera, Points, SRGBColorSpace, Scene, ShaderMaterial, Sprite, SpriteMaterial, Vector2, Vector4, WebGLRenderer, type Texture } from 'three';
import { LABELS, type LabelId } from '@/data/labels';

const rustig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = <T extends Element>(sel: string) => document.querySelector(sel) as T;

// ---------- WebGL ----------
const canvas = $<HTMLCanvasElement>('#heelal');
let renderer: WebGLRenderer | null = null;
try {
  renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x030305, 1);
} catch {
  root.classList.add('geen-webgl');
}

const klein = Math.min(innerWidth, innerHeight) < 700;
const N = klein ? 3600 : 6000;
const N_NEVEL = klein ? 160 : 260;
const R = 10.5;

const ARMEN = LABELS.map((l) => new Color(l.kleur));
const WIT = new Color('#FFF6EC');
const TINTEN = ['#FFFFFF', '#FFE2C4', '#C9DAFF', '#FFF3E0'].map((c) => new Color(c));

function gauss(): number {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Eén punt in het stelsel: straal, hoek, hoogte, kleur en het kwart (label) waar hij in het menu heen gaat. */
function stelselPunt(nevel: boolean) {
  const q = Math.random();
  const kleur = new Color();
  const kw = Math.floor(Math.random() * 4);
  let r: number;
  let th: number;
  let h: number;
  let fijn = false;
  if (!nevel && q < 0.07) {
    // kern
    r = Math.abs(gauss()) * 1.5;
    th = Math.random() * Math.PI * 2;
    h = gauss() * 0.5 * Math.exp(-r / 1.6);
    kleur.copy(WIT).lerp(new Color('#FFD6A8'), Math.random() * 0.5).multiplyScalar(0.75);
  } else if (!nevel && q < 0.2) {
    // schijf tussen de armen
    r = Math.pow(Math.random(), 0.6) * R * 1.05;
    th = Math.random() * Math.PI * 2;
    h = gauss() * 0.16;
    fijn = true;
    const k = Math.floor((((th / (Math.PI / 2)) % 4) + 4) % 4);
    kleur.copy(WIT).lerp(ARMEN[k], 0.25).multiplyScalar(0.5);
  } else {
    // vier armen
    const t = Math.pow(Math.random(), nevel ? 0.7 : 0.85);
    const r0 = 0.7 + t * R;
    const stof = !nevel && Math.random() < 0.62;
    const spreiding = nevel ? 2.4 : stof ? 2.8 : 1.5;
    r = Math.max(0.2, r0 + gauss() * (0.07 + 0.035 * r0) * spreiding);
    th = (kw * Math.PI) / 2 + 2.9 * Math.log(1 + r0 * 0.8) + gauss() * 0.045 * spreiding;
    h = gauss() * (nevel ? 0.3 : 0.1);
    const naarWit = 0.42 + Math.pow(Math.max(0, 1 - r0 / 5), 1.4) * 0.5 + (Math.random() < 0.2 ? 0.3 : 0);
    kleur.copy(ARMEN[kw]).lerp(WIT, Math.min(1, naarWit));
    if (stof) {
      kleur.multiplyScalar(0.7);
      fijn = true;
    }
  }
  return { r, th, h, kleur, fijn, kw };
}

function maakLaag(aantal: number, nevel: boolean): BufferGeometry {
  const v3 = () => new Float32Array(aantal * 3);
  const scatter = v3(), wolk = v3(), gal = v3(), arm = v3(), tint = v3(), kwKleur = v3();
  const maat = new Float32Array(aantal), rnd = new Float32Array(aantal), kwart = new Float32Array(aantal);
  const kwPos = new Float32Array(aantal * 2);
  for (let i = 0; i < aantal; i++) {
    scatter.set([(Math.random() * 2 - 1) * 62, (Math.random() * 2 - 1) * 38, -Math.random() * 80 + 10], i * 3);
    wolk.set([gauss() * 3.4, gauss() * 2.6, gauss() * 3.4], i * 3);
    const p = stelselPunt(nevel);
    gal.set([p.r, p.th, p.h], i * 3);
    arm.set([p.kleur.r, p.kleur.g, p.kleur.b], i * 3);
    const t = TINTEN[Math.floor(Math.random() * TINTEN.length)];
    tint.set([t.r, t.g, t.b], i * 3);
    maat[i] = nevel ? 14 + Math.random() * 22 : p.fijn ? 0.5 + Math.random() * 0.5 : 3.2 + Math.pow(Math.random(), 3) * 6.2;
    rnd[i] = Math.random();
    kwart[i] = p.kw;
    kwPos.set([Math.random() * 2 - 1, Math.random() * 2 - 1], i * 2);
    const kk = ARMEN[p.kw].clone().lerp(WIT, 0.25 + Math.random() * 0.35);
    kwKleur.set([kk.r, kk.g, kk.b], i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(wolk, 3));
  g.setAttribute('aScatter', new BufferAttribute(scatter, 3));
  g.setAttribute('aCloud', new BufferAttribute(wolk, 3));
  g.setAttribute('aGal', new BufferAttribute(gal, 3));
  g.setAttribute('aArm', new BufferAttribute(arm, 3));
  g.setAttribute('aTint', new BufferAttribute(tint, 3));
  g.setAttribute('aSize', new BufferAttribute(maat, 1));
  g.setAttribute('aRand', new BufferAttribute(rnd, 1));
  g.setAttribute('aKw', new BufferAttribute(kwart, 1));
  g.setAttribute('aKwPos', new BufferAttribute(kwPos, 2));
  g.setAttribute('aKwKleur', new BufferAttribute(kwKleur, 3));
  return g;
}

const uniforms = {
  uT: { value: 0 }, uTime: { value: 0 }, uScroll: { value: 0 }, uPR: { value: 1 }, uScale: { value: 140 },
  uSpin: { value: rustig ? 0 : 1 }, uHelder: { value: klein ? 0.72 : 1 },
  uTilt: { value: new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(new Euler(Math.PI / 2, 0, 0))) },
  uMuis: { value: new Vector2() }, uKracht: { value: 0 }, uAspect: { value: 1 },
  uMenu: { value: 0 }, uStijl: { value: 1 }, uStijlNaar: { value: 1 }, uOvergang: { value: 0 },
  uTint: { value: new Color('#ffffff') }, uTintMix: { value: 0 }, uGekozen: { value: -1 }, uWeg: { value: 0 },
  uVak0: { value: new Vector4(-0.5, 0.5, 0.5, 0.5) }, uVak1: { value: new Vector4(0.5, 0.5, 0.5, 0.5) },
  uVak2: { value: new Vector4(-0.5, -0.5, 0.5, 0.5) }, uVak3: { value: new Vector4(0.5, -0.5, 0.5, 0.5) },
};
const VAKKEN = [uniforms.uVak0, uniforms.uVak1, uniforms.uVak2, uniforms.uVak3];

const vertexShader = /* glsl */ `
  uniform float uT, uTime, uScroll, uPR, uScale, uSpin, uNevel, uHelder, uKracht, uAspect, uMenu, uStijl, uStijlNaar, uOvergang;
  uniform vec4 uVak0, uVak1, uVak2, uVak3;
  uniform vec3 uTint;
  uniform float uTintMix, uGekozen, uWeg;
  uniform vec2 uMuis;
  uniform mat3 uTilt;
  attribute vec3 aScatter, aCloud, aGal, aArm, aTint;
  attribute float aSize, aRand, aKw;
  attribute vec2 aKwPos;
  attribute vec3 aKwKleur;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vPx;
  float ease(float x) { return x < .5 ? 4. * x * x * x : 1. - pow(-2. * x + 2., 3.) / 2.; }
  void main() {
    float r = aGal.x, th = aGal.y;
    // intro: losse sterren, dan een wolk, dan het stelsel
    float fade = smoothstep(.3 + aRand, 1.3 + aRand, uT);
    float p1 = ease(clamp((uT - (1.5 + aRand * .6)) / 1.6, 0., 1.));
    float p2 = ease(clamp((uT - (3.0 + aRand * .5 + r * .045)) / 2.1, 0., 1.));
    float ca = uTime * .07;
    vec3 wolk = aCloud;
    wolk.xz = mat2(cos(ca), -sin(ca), sin(ca), cos(ca)) * wolk.xz;
    // elke ster beweegt los rond zijn plek in het stelsel
    float draai = (1. - p2) * 2.8 * (1. - r / 13.);
    float f = .45 + aRand * 1.1;
    float fase = aRand * 43.98;
    float rr = r + sin(uTime * f + fase) * (.1 + .045 * r) * uSpin;
    float a = th + uTime * uSpin * .045 + draai + cos(uTime * f * 1.27 + fase * 1.7) * (.03 + .05 / (1. + r)) * uSpin;
    vec3 gal = uTilt * vec3(rr * cos(a), 0., rr * sin(a));
    vec3 pos = mix(mix(aScatter, wolk, p1), gal, p2);
    // scrollen: het stelsel valt uiteen in een sterrenhemel
    float s = smoothstep(0., 1., clamp(uScroll * (.75 + aRand * .55), 0., 1.));
    pos = mix(pos, aScatter * 1.2, s);
    vec4 mv = modelViewMatrix * vec4(pos, 1.);
    gl_Position = projectionMatrix * mv;
    // muis: sterren wijken uit en draaien mee rond de cursor
    vec2 d = gl_Position.xy / gl_Position.w - uMuis;
    d.x *= uAspect;
    float afst = length(d);
    float invloed = exp(-afst * afst / .075) * uKracht * (1. - s) * p2;
    vec2 richting = d / max(afst, 1e-4);
    vec2 verschuif = (richting * .085 + vec2(-richting.y, richting.x) * .06) * invloed * (.55 + aRand * .9);
    verschuif.x /= uAspect;
    gl_Position.xy += verschuif * gl_Position.w;
    // menu: elke ster vliegt in een boogje naar het kwart van zijn label
    float m = smoothstep(0., 1., clamp(uMenu * 1.35 - aRand * .35, 0., 1.));
    if (m > 0.) {
      vec4 vak = aKw < .5 ? uVak0 : aKw < 1.5 ? uVak1 : aKw < 2.5 ? uVak2 : uVak3;
      vec2 teken = vec2(mod(aKw, 2.) < .5 ? -1. : 1., aKw < 1.5 ? 1. : -1.);
      float isStelsel = mix(abs(uStijl - 1.) < .5 ? 1. : 0., abs(uStijlNaar - 1.) < .5 ? 1. : 0., uOvergang);
      // een eigen klein sterrenstelsel per label, met twee armen
      float a2 = a - aKw * 1.5708 + step(.5, fract(aRand * 7.31)) * 3.14159 + uTime * .08;
      vec2 lok = vec2(rr * cos(a2), rr * sin(a2)) / 12.3;
      float ry = min(vak.w, vak.z * uAspect) * .66;
      vec2 doelStelsel = vak.xy + vec2(vak.z * .2, vak.w * .24) + lok * vec2(ry / uAspect, ry);
      // of uitwaaieren vanuit het midden (AIO): dicht bij het midden, dunner naar buiten
      vec2 binnen = vak.xy - teken * vak.zw;
      float hoek = (aKwPos.x * .5 + .5) * 1.5708;
      float straal = pow(aKwPos.y * .5 + .5, 1.7) * 1.3;
      vec2 o = vec2(cos(hoek), sin(hoek)) * straal;
      float mc = max(o.x, o.y);
      if (mc > .96) o *= (.5 + .45 * fract(aRand * 13.7)) * .96 / mc;
      vec2 doelWaaier = binnen + teken * (vec2(.02) + o) * vak.zw * 2.;
      vec2 doel = mix(doelWaaier, doelStelsel, smoothstep(0., 1., isStelsel));
      float w = gl_Position.w;
      vec2 nu = w > .05 ? gl_Position.xy / w : doel;
      vec2 baan = mix(nu, doel, m) + vec2(-(doel - nu).y, (doel - nu).x) * sin(m * 3.14159) * .18;
      gl_Position = vec4(baan, 0., 1.);
    }
    float twinkel = .88 + .12 * sin(uTime * (.6 + aRand * 2.2) + aRand * 60.);
    float maat = .7 * aSize * mix(1., 1.2, p2) * mix(1., .8, s) * (1. + invloed * .3);
    vColor = mix(mix(mix(aTint, aArm, p2 * (1. - s * .7)), vec3(1.), invloed * .12), aKwKleur, m);
    vColor = mix(vColor, mix(uTint, vec3(1.), aRand * .45), uTintMix * .8);
    float px = maat * uScale * uPR / -mv.z;
    if (uNevel > .5) {
      vAlpha = p2 * (1. - s) * fade * (1. + invloed * .4);
      gl_PointSize = min(px, 150. * uPR);
    } else {
      float helder = aSize < 1.5 ? .9 : 1.;
      vAlpha = fade * twinkel * helder * uHelder * (1. + invloed * .55);
      px = mix(px, clamp(px, 1.6 * uPR, 7. * uPR), m);
      vAlpha *= mix(1., mix(uStijl > 1.5 ? .6 : 1., uStijlNaar > 1.5 ? .6 : 1., uOvergang), m);
      if (uGekozen > -.5 && abs(aKw - uGekozen) > .5) vAlpha *= 1. - uWeg * m;
      float minPx = 1.25 * uPR;
      if (px < minPx) { vAlpha *= px / minPx; px = minPx; }
      gl_PointSize = min(px, 70. * uPR);
    }
    vPx = gl_PointSize;
  }
`;
const fragmentShader = /* glsl */ `
  uniform float uNevel;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vPx;
  void main() {
    vec2 c = gl_PointCoord - .5;
    float d2 = dot(c, c);
    float a; vec3 kleur;
    if (uNevel > .5) {
      a = exp(-d2 * 12.) * .01;
      kleur = vColor;
    } else {
      // in echte pixels: een scherp speldenprikje met een korte gloed
      float dpx = sqrt(d2) * vPx;
      float rpx = clamp(vPx * .085, .75, 2.1);
      float schijf = 1. - smoothstep(rpx - .35, rpx + .35, dpx);
      float rg = rpx * 1.7 + .4;
      float gloed = exp(-(dpx * dpx) / (rg * rg)) * .32;
      a = schijf + gloed * (1. - schijf);
      kleur = mix(vColor * 1.45, vec3(1.), schijf * (.35 + .5 * smoothstep(rpx, 0., dpx)));
    }
    a *= vAlpha;
    if (a < .002) discard;
    gl_FragColor = vec4(kleur, a);
  }
`;

const maakMateriaal = (nevel: boolean) =>
  new ShaderMaterial({
    uniforms: { ...uniforms, uNevel: { value: nevel ? 1 : 0 } },
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: AdditiveBlending,
  });

const scene = new Scene();
const camera = new PerspectiveCamera(45, 1, 0.1, 400);
const nevel = new Points(maakLaag(N_NEVEL, true), maakMateriaal(true));
const sterren = new Points(maakLaag(N, false), maakMateriaal(false));
nevel.frustumCulled = sterren.frustumCulled = false;
scene.add(nevel, sterren);

/** Zachte gloed in het centrum van het stelsel (AIO). */
function gloedTextuur(binnen: string, buiten: string): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, binnen);
  g.addColorStop(0.07, binnen);
  g.addColorStop(0.22, buiten);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
const sprite = (binnen: string, buiten: string) =>
  new Sprite(new SpriteMaterial({ map: gloedTextuur(binnen, buiten), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
const kern = sprite('rgba(255,252,246,1)', 'rgba(255,226,196,.45)');
const halo = sprite('rgba(190,170,255,.5)', 'rgba(120,110,255,.12)');
kern.scale.setScalar(klein ? 3.6 : 4.6);
halo.scale.setScalar(12);
scene.add(halo, kern);

let afstand = 25;
function maat(): void {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  const pr = Math.min(devicePixelRatio || 1, 2);
  renderer?.setPixelRatio(pr);
  renderer?.setSize(w, h, false);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const tan = Math.tan(MathUtils.degToRad(22.5));
  const straal = R + 1.8;
  afstand = Math.max(straal / (tan * 0.94), straal / (tan * aspect * (aspect < 0.8 ? 1.04 : 0.94)));
  uniforms.uPR.value = pr;
  uniforms.uScale.value = 140 * (Math.min(h, w * 1.25) / 900) * (afstand / 25);
  uniforms.uAspect.value = aspect;
}
maat();
addEventListener('resize', maat);

// ---------- muis ----------
let doelKracht = 0, kracht = 0, laatsteMuis = -Infinity;
const muis = new Vector2(), muisDoel = new Vector2();
if (!rustig) {
  const volg = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') laatsteMuis = performance.now();
    muisDoel.set((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
    if (doelKracht === 0) muis.copy(muisDoel);
    doelKracht = 1;
  };
  addEventListener('pointermove', volg);
  addEventListener('pointerdown', volg);
  document.addEventListener('pointerleave', () => { doelKracht = 0; });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') doelKracht = 0; });
  addEventListener('blur', () => { doelKracht = 0; });
}

// ---------- pagina ----------
const zin = $<HTMLElement>('.zin');
const labels = $<HTMLElement>('.labels');
const panelen = [...document.querySelectorAll<HTMLElement>('.label')];
const titel = $<HTMLElement>('h1');
const hint = $<HTMLElement>('.hint');
const tab = $<HTMLElement>('.tab span');
const reis = $<HTMLElement>('.reis');
const hoofdstukken = new Map([...document.querySelectorAll<HTMLElement>('[data-hoofdstuk]')].map((el) => [el.dataset.hoofdstuk as LabelId, el]));
const menuKnoppen = [...document.querySelectorAll<HTMLButtonElement>('.hoofdmenu button')];
const labelVan = (id: LabelId) => LABELS.find((l) => l.id === id)!;
const zoek = new URLSearchParams(location.search);
const start = performance.now() - (rustig ? 9000 : Number(zoek.get('t') || 0) * 1000);
const glad = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Menustijl: voorlopig alleen nevels (besluit Jordan 02-10-2026). De andere stijlen blijven beschikbaar voor later:
// zet AUTOMATISCH_WISSELEN op true om ze elke 5 seconden te laten afwisselen zolang de muis stilligt.
// Bekijken kan ook met ?stijl=stelsel, ?stijl=planeet of ?stijl=horizon.
const AUTOMATISCH_WISSELEN = false;
const STIJLEN = ['nevel', 'stelsel', 'planeet', 'horizon'] as const;
const WISSEL_MS = 5000, OVERGANG_MS = 1800, MUIS_RUST_MS = 1200;
let stijlNu = Math.max(0, STIJLEN.indexOf((zoek.get('stijl') || 'nevel') as (typeof STIJLEN)[number]));
let stijlVolgend = stijlNu, overgangStart = 0, wisselVanaf = 0;
const zetStijl = (i: number) => { document.body.dataset.stijl = STIJLEN[i]; };
zetStijl(stijlNu);
function stijlStap(nu: number, menuZichtbaar: boolean, rust: boolean): void {
  // Echte tijd (niet per beeld opgeteld), en de klok loopt ook tijdens de overgang: precies WISSEL_MS tussen twee wissels.
  // Na muisbeweging, buiten het menu of met minder beweging begint de klok opnieuw.
  if (rust || !menuZichtbaar || rustig) wisselVanaf = nu;
  if (overgangStart) {
    const o = Math.min(1, (performance.now() - overgangStart) / OVERGANG_MS);
    uniforms.uStijl.value = stijlNu;
    uniforms.uStijlNaar.value = stijlVolgend;
    uniforms.uOvergang.value = o * o * (3 - 2 * o);
    if (o >= 1) {
      stijlNu = stijlVolgend;
      overgangStart = 0;
      uniforms.uStijl.value = stijlNu;
      uniforms.uOvergang.value = 0;
    }
    return;
  }
  uniforms.uStijl.value = stijlNu;
  uniforms.uStijlNaar.value = stijlNu;
  if (AUTOMATISCH_WISSELEN && nu - wisselVanaf >= WISSEL_MS) {
    wisselVanaf = nu;
    stijlVolgend = (stijlNu + 1) % STIJLEN.length;
    zetStijl(stijlVolgend);
    overgangStart = performance.now();
  }
}

// ---------- rand, tabje en inzoomen ----------
const NEUTRAAL = '#F3ECE1';
let gekozen: LabelId | null = null, hoverLabel: LabelId | null = null, navHover: LabelId | null = null;
let tabTekst = '', huidigMenu: LabelId | null | undefined;
const zetRand = (kleur: string, kracht: number) => {
  root.style.setProperty('--rand', kleur);
  root.style.setProperty('--rand-kracht', String(kracht));
};
const zetTab = (tekst: string) => {
  if (tekst !== tabTekst) tab.textContent = tabTekst = tekst;
};
const gedrag = (): ScrollBehavior => (rustig ? 'auto' : 'smooth');
const menuEind = () => reis.offsetTop + reis.offsetHeight - innerHeight;

/** Voert fn uit zodra het scrollen 200 ms stilstaat. */
function naStil(fn: () => void): void {
  let wacht = 0;
  const opScroll = () => {
    clearTimeout(wacht);
    wacht = window.setTimeout(() => { removeEventListener('scroll', opScroll); fn(); }, 200);
  };
  addEventListener('scroll', opScroll);
  opScroll();
}

const kijker = new IntersectionObserver((items) => items.forEach((e) => { if (e.isIntersecting) e.target.classList.add('zichtbaar'); }), { threshold: 0.25 });
document.querySelectorAll('.scene').forEach((el) => kijker.observe(el));

function zoom(id: LabelId): void {
  const hoofdstuk = hoofdstukken.get(id)!;
  if (gekozen === id) { hoofdstuk.scrollIntoView({ behavior: gedrag() }); return; }
  gekozen = id;
  labels.dataset.gekozen = id;
  panelen.forEach((p) => p.classList.toggle('gekozen', p.dataset.label === id));
  hoofdstukken.forEach((el, k) => { el.hidden = k !== id; });
  uniforms.uTint.value.set(labelVan(id).kleur);
  setTimeout(() => hoofdstuk.scrollIntoView({ behavior: gedrag() }), rustig ? 0 : 1100);
}
function terug(): void {
  const afronden = () => {
    gekozen = null;
    delete labels.dataset.gekozen;
    panelen.forEach((p) => p.classList.remove('gekozen'));
    hoofdstukken.forEach((el) => { el.hidden = true; });
  };
  if (Math.abs(scrollY - menuEind()) < 4) { afronden(); return; }
  scrollTo({ top: menuEind(), behavior: gedrag() });
  naStil(afronden);
}
function naarLabel(id: LabelId): void {
  if (gekozen || Math.abs(scrollY - menuEind()) < innerHeight * 0.3) { zoom(id); return; }
  scrollTo({ top: menuEind(), behavior: gedrag() });
  naStil(() => zoom(id));
}

document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) => b.addEventListener('click', () => zoom(b.dataset.zoom as LabelId)));
document.querySelectorAll('[data-terug], .terug').forEach((b) => b.addEventListener('click', terug));
// 'Naar de labels' (voor toetsenbord): direct naar het menu, met de focus erop
$<HTMLAnchorElement>('.naar-inhoud').addEventListener('click', (e) => {
  e.preventDefault();
  scrollTo({ top: menuEind(), behavior: 'auto' });
  requestAnimationFrame(() => requestAnimationFrame(() => labels.focus()));
});
menuKnoppen.forEach((b) => {
  const id = b.dataset.ga as LabelId;
  const aan = () => { navHover = id; };
  const uit = () => { if (navHover === id) navHover = null; };
  b.addEventListener('pointerenter', aan);
  b.addEventListener('focus', aan);
  b.addEventListener('pointerleave', uit);
  b.addEventListener('blur', uit);
  b.addEventListener('click', () => naarLabel(id));
});
panelen.forEach((p) => {
  const id = p.dataset.label as LabelId;
  const aan = () => { hoverLabel = id; };
  const uit = () => { if (hoverLabel === id) hoverLabel = null; };
  p.addEventListener('pointerenter', aan);
  p.addEventListener('focusin', aan);
  p.addEventListener('pointerleave', uit);
  p.addEventListener('focusout', uit);
});

// ---------- elk beeld ----------
let klaar = false, laatsteNu = 0;
function frame(nu: number): void {
  requestAnimationFrame(frame);
  if (document.hidden) { laatsteNu = nu; return; }
  const dt = Math.min(0.05, laatsteNu ? (nu - laatsteNu) / 1000 : 0.016);
  laatsteNu = nu;
  const t = (nu - start) / 1000;
  const tijd = rustig ? 0 : t;
  const v = scrollY / innerHeight;
  const s = Math.min(1, Math.max(0, v / 1.15));
  const hoofdstuk = gekozen ? hoofdstukken.get(gekozen)! : null;
  const c = hoofdstuk ? (scrollY + innerHeight - hoofdstuk.offsetTop) / innerHeight : 0;
  const menu = (rustig ? 1 : glad(1.7, 2.6, v)) * (1 - glad(0.15, 0.9, c));
  const tekst = rustig ? 1 : glad(2.95, 3.35, v);

  // de pagina
  zin.style.setProperty('--zin', String(glad(0.75, 1.15, v) * (1 - glad(1.5, 1.85, v))));
  panelen.forEach((p, i) => p.style.setProperty('--v', `${(rustig ? 150 : glad(2.3 + i * 0.07, 3.05 + i * 0.07, v) * 150).toFixed(2)}%`));
  labels.style.setProperty('--t', String(tekst));
  labels.classList.toggle('actief', tekst > 0.6);
  labels.inert = !rustig && tekst < 0.3;
  if (!klaar && t > 4.9) { klaar = true; document.body.classList.add('klaar'); }
  titel.style.opacity = String(1 - glad(0.02, 0.32, s));
  hint.style.opacity = klaar ? String(1 - glad(0, 0.12, s)) : '';

  // rand en tabje: regenboog, of de kleur van het label onder de muis of het gekozen label
  const actief = navHover || gekozen || (tekst > 0.6 ? hoverLabel : null);
  // de kwarten vullen het scherm: een stilliggende muis staat altijd op een kwart, dus alleen beweging pauzeert het wisselen
  stijlStap(nu, tekst > 0.9, Boolean(gekozen || navHover) || nu - laatsteMuis < MUIS_RUST_MS);
  if (gekozen !== huidigMenu) {
    huidigMenu = gekozen;
    menuKnoppen.forEach((b) => b.setAttribute('aria-current', String(b.dataset.ga === gekozen)));
  }
  root.classList.toggle('label-kleur', Boolean(actief));
  if (actief) { zetRand(labelVan(actief).kleur, 1); zetTab(labelVan(actief).naam); }
  else { zetRand(NEUTRAAL, tekst > 0.6 ? 0.7 : 0.5); zetTab(tekst > 0.6 ? 'Labels' : 'AIO Plus'); }
  root.style.setProperty('--voortgang', String(Math.min(1, scrollY / Math.max(1, root.scrollHeight - innerHeight))));
  root.style.setProperty('--gloed', String(gekozen ? glad(0, 0.8, c) : 0));

  if (!renderer) return;
  // het heelal
  uniforms.uTintMix.value = gekozen ? 0.25 + 0.75 * glad(0, 0.8, c) : 0;
  uniforms.uGekozen.value = gekozen ? LABELS.findIndex((l) => l.id === gekozen) : -1;
  uniforms.uWeg.value += ((gekozen ? 1 : 0) - uniforms.uWeg.value) * (1 - Math.exp(-dt * 5));
  if (menu > 0) {
    panelen.forEach((p, i) => {
      const b = p.getBoundingClientRect();
      VAKKEN[i].value.set(((b.left + b.width / 2) / innerWidth) * 2 - 1, 1 - ((b.top + b.height / 2) / innerHeight) * 2, b.width / innerWidth, b.height / innerHeight);
    });
  }
  uniforms.uT.value = t;
  uniforms.uTime.value = tijd;
  uniforms.uScroll.value = s;
  uniforms.uMenu.value = menu;
  muis.lerp(muisDoel, 1 - Math.exp(-dt * 7));
  kracht += (doelKracht - kracht) * (1 - Math.exp(-dt * (doelKracht > kracht ? 4 : 1.6)));
  uniforms.uMuis.value.copy(muis);
  uniforms.uKracht.value = kracht;
  const vorm = glad(3.6, 5.8, t) * (1 - glad(0, 0.6, s));
  kern.material.opacity = vorm * (0.42 + 0.04 * Math.sin(tijd * 1.3));
  halo.material.opacity = vorm * 0.1;
  camera.position.set(0, 0, afstand * (1 - 0.62 * s));
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
