# RSTR

A poster generator for a phone. Pick a style, shuffle until something lands, type the words, export for the Instagram feed or a story. It composes type, colour and geometry inside rules, from a seed. It is not AI image generation.

## What it does today

A phone app in Simple mode: pick a style (Swiss, Postmodern, Brutalist, Vaporwave) and a format (1:1, 3:4, 9:16), Shuffle, lock palette, type, graphic or layout, edit title, subtitle, info and caption, Back, Keep into a Kept sheet, export JPEG or PNG at three sizes. Design, Back steps, Kept and locks are saved and survive reload. The engine lays out, builds a Scene and paints it, with checks for overflow, overlap and contrast. Eight palettes per style, each in light and dark (Light/Dark on the Look tab). 42 font pairings from Google Fonts, fetched on demand and cached (online lines not yet verified). Finish and Marks are in the spec but offer only Clean and Off until bundle 2; the Advanced switch shows Simple's tabs until bundle 3. `docs/design/refs/` shows the looks it targets.

## Where it is going

- **Plug and play:** fonts, palettes and graphics are built in. Nothing to manage.
- **Four styles:** Swiss, Postmodern (ice cream and photocopy grunge), Brutalist, Vaporwave, each with wide variety: many layouts, tilts and turns, graphics combined and pushed to extremes.
- **Five finishes** over any style: Clean, Grain, Grunge, VHS, Glitch.
- **Marks:** an optional layer of small technical graphics.
- **Light and dark** for every palette; the colours of the design on screen can be edited.
- **42 font pairings** from free Google Fonts.
- **One photo** you upload: Shuffle moves and crops it; monochrome, duotone, halftone and more.
- **Text:** four slots at first, then layers you add, remove and rank.
- **Sizes:** 1:1, 3:4, 9:16 and paper ratio; JPEG, PNG or WebP at 1x to 3x; a print file good for A3.
- **Simple and Advanced** modes on one switch.
- **Mix (experimental):** crosses of two styles.
- Then motion (MP4), then the APK.

## Status

| Bundle | What | State |
|---|---|---|
| 1 | Engine, colour, type, frame and Simple mode | Done: R1 to R4 and the viewer check; R3's online lines open (H3) |
| 2 | Parts and variety, Swiss, Postmodern, finishes, marks | Queued |
| 3 | Brutalist, Vaporwave, Advanced mode | Queued |
| 4 | Photo and export, A3 print | Queued |
| 5 | Text layers, retouch | Queued |
| 6 | Mix | Queued |

## How it is built

`docs/SPEC.md` is the app, `docs/RUN.md` is how a chat builds a row, `docs/BACKLOG.md` is the queue, `docs/CHANGELOG.md` is the record of what changed, `docs/PROCESS.md` the record of how each chat went, `docs/reviews/` every review. `docs/plan.html` is the plan as a page (open it in a browser; it has a live demo of the spike). `docs/archive/` keeps the first plan and the spike.
