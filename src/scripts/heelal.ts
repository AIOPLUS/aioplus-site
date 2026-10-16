/**
 * Het heelal van aioplus.ai: een sterrenstelsel met vier armen in de labelkleuren (AIO in het midden), alleen in de opening
 * (besluit Jordan 15-10-2026, verbeterplan in de hub: docs/website/VERBETERPLAN.md).
 * Na een korte intro staat het stelsel stil; het beweegt alleen als de bezoeker scrolt of de muis beweegt, en alleen dan
 * wordt er getekend. Bij het scrollen valt het uiteen en vervaagt het; daaronder staat de pagina op een effen achtergrond.
 * Eén WebGL-doek met Three.js; alle beweging gebeurt in de shader. Werkt ook zonder WebGL en met minder beweging.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Euler, Matrix3, Matrix4, PerspectiveCamera, Points, SRGBColorSpace, Scene, ShaderMaterial, Sprite, SpriteMaterial, Vector2, WebGLRenderer, type Texture } from 'three';
import { LABELS } from '@/data/labels';

const rustig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const canvas = document.getElementById('heelal') as HTMLCanvasElement;
const opening = document.querySelector<HTMLElement>('.opening')!;

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
/** De intro (losse sterren, wolk, stelsel) speelt sneller af dan vroeger: rond 3 s in plaats van 6 s. */
const TEMPO = 2;
const INTRO_EIND = 5.8;

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

/** Eén punt in het stelsel: straal, hoek, hoogte en kleur. De vier armen hebben de kleuren van de labels. */
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
  return { r, th, h, kleur, fijn };
}

function maakLaag(aantal: number, nevel: boolean): BufferGeometry {
  const v3 = () => new Float32Array(aantal * 3);
  const scatter = v3(), wolk = v3(), gal = v3(), arm = v3(), tint = v3();
  const maat = new Float32Array(aantal), rnd = new Float32Array(aantal);
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
  return g;
}

const uniforms = {
  uT: { value: 0 }, uTime: { value: 0 }, uScroll: { value: 0 }, uPR: { value: 1 }, uScale: { value: 140 },
  uSpin: { value: rustig ? 0 : 1 }, uHelder: { value: klein ? 0.72 : 1 },
  uTilt: { value: new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(new Euler(Math.PI / 2, 0, 0))) },
  uMuis: { value: new Vector2() }, uKracht: { value: 0 }, uAspect: { value: 1 },
};

const vertexShader = /* glsl */ `
  uniform float uT, uTime, uScroll, uPR, uScale, uSpin, uNevel, uHelder, uKracht, uAspect;
  uniform vec2 uMuis;
  uniform mat3 uTilt;
  attribute vec3 aScatter, aCloud, aGal, aArm, aTint;
  attribute float aSize, aRand;
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
    // elke ster beweegt los rond zijn plek in het stelsel (alleen tijdens de intro: daarna staat uTime stil)
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
    float twinkel = .88 + .12 * sin(uTime * (.6 + aRand * 2.2) + aRand * 60.);
    float maat = .7 * aSize * mix(1., 1.2, p2) * mix(1., .8, s) * (1. + invloed * .3);
    vColor = mix(mix(aTint, aArm, p2 * (1. - s * .7)), vec3(1.), invloed * .12);
    float px = maat * uScale * uPR / -mv.z;
    if (uNevel > .5) {
      vAlpha = p2 * (1. - s) * fade * (1. + invloed * .4);
      gl_PointSize = min(px, 150. * uPR);
    } else {
      float helder = aSize < 1.5 ? .9 : 1.;
      vAlpha = fade * twinkel * helder * uHelder * (1. + invloed * .55);
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

/**
 * Het stelsel staat naast de tekst: op een breed scherm rechts, op een smal scherm (staand) bovenin.
 * setViewOffset verschuift het beeld zonder het stelsel te vervormen.
 */
let afstand = 25;
let tekenTot = 0;
const tekenEven = (ms = 600) => { tekenTot = Math.max(tekenTot, performance.now() + ms); };
function maat(): void {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  const pr = Math.min(devicePixelRatio || 1, 2);
  renderer?.setPixelRatio(pr);
  renderer?.setSize(w, h, false);
  camera.aspect = aspect;
  const breed = aspect > 1.15;
  const staand = aspect < 0.8;
  camera.setViewOffset(w, h, breed ? -w * 0.22 : 0, staand ? h * 0.17 : 0, w, h);
  camera.updateProjectionMatrix();
  const tan = Math.tan((22.5 * Math.PI) / 180);
  const straal = R + 1.8;
  afstand = Math.max(straal / (tan * 0.94), straal / (tan * aspect * (aspect < 0.8 ? 1.04 : 0.94))) * (breed ? 1.06 : staand ? 1.12 : 1);
  uniforms.uPR.value = pr;
  uniforms.uScale.value = 140 * (Math.min(h, w * 1.25) / 900) * (afstand / 25);
  uniforms.uAspect.value = aspect;
  tekenEven();
}
maat();
addEventListener('resize', maat);

// ---------- muis (alleen in de opening) ----------
let doelKracht = 0, kracht = 0;
const muis = new Vector2(), muisDoel = new Vector2();
if (!rustig) {
  const volg = (e: PointerEvent) => {
    // schermcoördinaten (-1..1); de verschuiving van setViewOffset zit al in de projectie van de sterren
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

// ---------- elk beeld ----------
const glad = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const zoek = new URLSearchParams(location.search);
const vooruit = rustig ? 9000 : Number(zoek.get('t') || 0) * 1000;
let start = performance.now() - vooruit;
let laatsteNu = 0, tijd = 0, vorigeScroll = -1;

// De shaders compileren op de achtergrond (KHR_parallel_shader_compile) in plaats van in het eerste beeld: zo blokkeert
// het stelsel de pagina niet terwijl de tekst al leesbaar is. De intro begint pas als alles klaar is.
let gereed = false;
renderer?.compileAsync(scene, camera).catch(() => undefined).then(() => {
  gereed = true;
  start = performance.now() - vooruit;
  tekenEven();
});

function frame(nu: number): void {
  requestAnimationFrame(frame);
  if (document.hidden || (renderer && !gereed)) { laatsteNu = nu; return; }
  const dt = Math.min(0.05, laatsteNu ? (nu - laatsteNu) / 1000 : 0.016);
  laatsteNu = nu;
  // intro-klok (versneld); daarna komt het stelsel in ~1,5 s tot stilstand
  const t = rustig ? 9 : ((nu - start) / 1000) * TEMPO;
  const snelheid = rustig ? 0 : 1 - glad(INTRO_EIND, INTRO_EIND + 3, t);
  tijd += dt * TEMPO * snelheid;

  // scrollen door de opening: het stelsel valt uiteen en vervaagt; daaronder een effen achtergrond
  const v = scrollY / Math.max(1, opening.offsetHeight);
  const weg = glad(0.25, 0.8, v);
  canvas.style.opacity = weg ? String(1 - weg) : '';
  if (!renderer || weg >= 1) return;

  const gescrold = scrollY !== vorigeScroll;
  vorigeScroll = scrollY;
  const bezig = snelheid > 0.0005 || gescrold || nu < tekenTot
    || Math.abs(kracht - doelKracht) > 0.002 || (kracht > 0.002 && muis.distanceToSquared(muisDoel) > 1e-6);
  if (!bezig) return;

  const s = Math.min(1, v / 1.1);
  uniforms.uT.value = t;
  uniforms.uTime.value = tijd;
  uniforms.uScroll.value = s;
  muis.lerp(muisDoel, 1 - Math.exp(-dt * 7));
  kracht += (doelKracht - kracht) * (1 - Math.exp(-dt * (doelKracht > kracht ? 4 : 1.6)));
  uniforms.uMuis.value.copy(muis);
  uniforms.uKracht.value = kracht;
  const vorm = glad(3.6, 5.8, t) * (1 - glad(0, 0.6, s));
  kern.material.opacity = vorm * (0.42 + 0.04 * Math.sin(tijd * 1.3));
  halo.material.opacity = vorm * 0.1;
  camera.position.set(0, 0, afstand * (1 - 0.5 * s));
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
