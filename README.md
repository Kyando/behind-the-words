# Behind the Words: Art Puzzles

*Find words, reveal the art.* A word-search game where every word you find uncovers part of a famous painting. Game plan and catalog research: `../entrelinhas-like/docs/behind-the-words/` (plan.md, art-catalog.md).

## The game (phase 0 prototype)

```bash
npm run dev               # play it (Vite)
npm run levels:generate   # lay out scripts/level-specs.ts into src/levels/ and copy their paintings to public/art/
npm test                  # every level is a valid board with its painting
```

Four levels in Room 1 (Starry Night, Great Wave, Girl with a Pearl Earring, Hiroshige's Sudden Shower).
- **Screens:** the trail (`src/ui/trail.ts`) → a level (`src/ui/level-view.ts`) → the restored painting with its label and story (`src/ui/story.ts`).
- **Engine from Twice Told Tales:** grid, steering, generator, session, sounds. The reveal paints each word's piece in full colour (`src/ui/pieces.ts`).
- **Look:** Tidy desk (`src/styles/theme-desk.css`, after A Little to the Left): cream paper, muted pastels, wobbly brown outlines, flat shadows, the board as a tray and taped prints, all in Mali. Other palettes stay previewable with `?theme=` and `?fx=` (`src/styles/themes.css`); `node scripts/capture-themes.ts [palettes|woodblock|lttl]` screenshots them into `docs/palettes/`.
- **Not built yet:** tickets, variants, prestige gates beyond the star count, and ads or purchases.

## Art raw material (`art/`)

257 public-domain artworks, from the Book of Kells to Mondrian: paintings, tapestries, manuscripts and Japanese prints across 16 periods.

| File | What it is | In git |
|---|---|---|
| `manifest.mjs` | The list of pieces and where each one comes from (`met:`, `aic:`, `commons:` search, or `file:` exact Commons file) | yes |
| `sources.json` | Everything the resolver found per piece: source ids, licence, museum metadata and tags, plus **reference-only** Wikipedia/AIC text | yes |
| `pieces.json` | Ship-safe metadata (no reference text) for the game | yes |
| `CREDITS.md` | Credits line per image, for the in-game credits screen | yes |
| `thumbs/` | 360 px previews for review | yes |
| `images/` | Working images, long edge 2400 px (~190 MB) | no, rebuild with `npm run art:download` |
| `contact-sheet.html` | Every piece with requested vs found title, licence and size | yes |

Sources: 75 from The Met (CC0), 9 from the Art Institute of Chicago (CC0), 173 from Wikimedia Commons (public domain or CC0 files; the holding museum is kept for credit).

**Licence rules.** Only works whose artist died before 1956 and that were made before 1931. Nothing from Italian state or Vatican collections, or under non-commercial licences (see the catalog's tier C). The Wikipedia extracts (CC BY-SA) and AIC descriptions (CC BY) in `sources.json` are for writing our own texts and word lists only. **Never ship them.**

## Scripts

```bash
npm run art:resolve      # find sources for new manifest rows (cached; --redo slug,slug to force)
npm run art:download     # download + resize, then write pieces.json and CREDITS.md
npm run art:sheet        # rebuild the contact sheet
node scripts/candidates.mjs commons "<query>"   # list candidate files to pin one with file:
node scripts/review-mosaic.mjs <outDir> [slugs]  # numbered mosaics for a visual check
node scripts/serve.mjs 5190                      # serve the repo to view the contact sheet
```

## Known follow-ups

- **Qingming scroll** (`along-the-river-…-qing-court-vers`): the 2400 px image is a 2400×72 strip. Levels need full-resolution segments cut from the original.
- About 13 images are between 1150 and 1600 px on the long edge (Jewish Bride, Fall of Icarus, Carnival and Lent, Garden of Love, Uccello's St George, Matisse's Dance, Franz Marc ×2, Adele Bloch-Bauer…). That's fine for a phone, but they can be upgraded with `candidates.mjs`.
- A few photos include the frame or a black band (Descent from the Cross, Horse Fair, Labille-Guiard). Crop them in the level spec.
- Every match was checked by eye on 2026-10-13 and about 30 were corrected. Re-check any new rows the same way.
