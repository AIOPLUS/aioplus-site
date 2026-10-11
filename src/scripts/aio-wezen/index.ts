/**
 * aio-wezen: AIO als levende 3D-ster (Three.js), voor de websites en de app. Ontwerp en afspraken: hub
 * docs/agent/MASCOTTE.md en docs/agent/AIO-KARAKTER.md (eigenaar: chat "AIO Plus - Agent").
 *
 * Gebruik:
 *   import { meld, zetLabel } from './aio-wezen/brein';   // licht, zonder Three.js: gebeurtenissen en label
 *   const { maakAio } = await import('./aio-wezen');      // de ster zelf (Three.js), pas laden als hij nodig is
 *   maakAio(knop, { grootte: 'klein' });
 *
 * De ster is decoratie: het canvas is aria-hidden en alle informatie staat ook als tekst. Zonder WebGL of bij
 * prefers-reduced-motion maakt maakAio niets aan en blijft de CSS-bol van de houder staan.
 */
import { AioSter, type AioOpties } from './ster';

export { meld, zetLabel, type AioGebeurtenis, type AioLabel } from './brein';
export type { AioOpties };

/** Zet een ster in de houder (de klasse heeft-ster verbergt de CSS-bol). Geeft null als het niet kan of niet mag. */
export function maakAio(houder: HTMLElement, opties: AioOpties): AioSter | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (houder.querySelector('canvas.aio-ster')) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'aio-ster';
  canvas.setAttribute('aria-hidden', 'true');
  houder.append(canvas);
  try {
    const ster = new AioSter(canvas, opties);
    houder.classList.add('heeft-ster');
    canvas.addEventListener('aio-ster-weg', () => { houder.classList.remove('heeft-ster'); canvas.remove(); }, { once: true });
    return ster;
  } catch {
    canvas.remove();
    return null;
  }
}
