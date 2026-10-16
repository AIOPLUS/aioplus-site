/**
 * De vier labels als tabbladen met één kaart (verbeterplan fase 3, hub docs/website/VERBETERPLAN.md).
 * - Tabbladen volgens het WAI-ARIA-patroon: pijltjes, Home en End wisselen; de kaart wisselt met een korte overgang.
 * - De labels in het hoofdmenu kiezen het tabblad en scrollen erheen.
 * - Kiest de bezoeker zelf een label, dan krijgt #labels data-gekozen: AIO (aio-gids.ts) kleurt dan mee.
 * - Het vraagveld in de opening stuurt de vraag naar AIO met het event 'aio:vraag'.
 */
const rustig = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sectie = document.getElementById('labels')!;
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"][data-tab]')];
const menuKnoppen = [...document.querySelectorAll<HTMLButtonElement>('.hoofdmenu button[data-ga]')];

function kies(id: string, { focus = false, doorBezoeker = true } = {}): void {
  for (const tab of tabs) {
    const aan = tab.dataset.tab === id;
    tab.setAttribute('aria-selected', String(aan));
    tab.tabIndex = aan ? 0 : -1;
    const paneel = document.getElementById(tab.getAttribute('aria-controls')!)!;
    paneel.hidden = !aan;
    if (aan && focus) tab.focus();
  }
  if (doorBezoeker) {
    sectie.dataset.gekozen = id;
    menuKnoppen.forEach((b) => b.setAttribute('aria-current', String(b.dataset.ga === id)));
  }
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => kies(tab.dataset.tab!));
  tab.addEventListener('keydown', (e) => {
    const naar = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (naar === undefined) return;
    e.preventDefault();
    kies(tabs[(naar + tabs.length) % tabs.length].dataset.tab!, { focus: true });
  });
});

// het hoofdmenu: label kiezen en naar de labels scrollen
menuKnoppen.forEach((b) => b.addEventListener('click', () => {
  kies(b.dataset.ga!);
  sectie.scrollIntoView({ behavior: rustig() ? 'auto' : 'smooth', block: 'start' });
}));

// "Naar de labels" (voor het toetsenbord) en "Bekijk de vier labels": focus op de sectie, zonder sprong in de adresbalk
document.querySelectorAll<HTMLAnchorElement>('a[href="#labels"]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  sectie.scrollIntoView({ behavior: rustig() ? 'auto' : 'smooth', block: 'start' });
  sectie.focus({ preventScroll: true });
}));

// ---------- het AIO-vraagveld in de opening ----------
const vorm = document.querySelector<HTMLFormElement>('.vraag-aio');
const veld = document.querySelector<HTMLInputElement>('#vraag-aio-veld');
const stelVraag = (tekst: string) => {
  const vraag = tekst.trim();
  if (!vraag) return false;
  // aio-gids.ts annuleert het event als AIO de vraag niet aanneemt (er loopt al een vraag): dan blijft de tekst staan
  const aangenomen = dispatchEvent(new CustomEvent('aio:vraag', { detail: vraag, cancelable: true }));
  // de focus niet terug in het veld: op een telefoon springt het toetsenbord dan weer open
  if (aangenomen) veld?.blur();
  return aangenomen;
};
vorm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (veld && stelVraag(veld.value)) veld.value = '';
});
document.querySelectorAll<HTMLButtonElement>('.voorbeeld').forEach((b) => b.addEventListener('click', () => stelVraag(b.textContent ?? '')));
