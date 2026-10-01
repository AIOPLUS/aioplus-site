# aioplus-site

Website van AIO Plus, live op https://www.aioplus.ai. De centrale instructies (bedrijf, labels, tools, werkafspraken) staan in de hub `AIOPLUS/claude`: lokaal `../CLAUDE.md`; in een cloud-chat haalt de SessionStart-hook ze op. Dit bestand bevat alleen wat specifiek is voor deze repo; de werking staat in `README.md`. Eigenaar: de chat "AIO Plus - Website".

**Main staat direct live.** Werk op een branch, draai `npm run check`, open een PR en merge pas na een groene check en Jordans akkoord.

## Waar staat wat

- **Labels (teksten, cijfers, kleuren, knoppen)**: `src/data/labels.ts`. Alleen feiten uit de brochures in de hub (`merk/`); geen klantenaantallen zonder akkoord van Jordan.
- **Merkgegevens en e-mailknoppen**: `src/config/site.ts` (`merk`, `mailto()`).
- **Pagina**: `src/pages/index.astro`; lay-out en zoekmachinegegevens in `src/layouts/BaseLayout.astro`.
- **Heelal, scroll-animaties en inzoomen**: `src/scripts/heelal.ts` (Three.js, alles in één shader).
- **Opmaak**: `src/styles/global.css`, tokens in `src/styles/tokens.css`.
- **CI**: `.github/workflows/ci.yml` draait `npm run check` op elke pull request; `deploy.yml` zet main live op GitHub Pages.
