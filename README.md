# RSTR

A poster generator for a phone. Pick a style, shuffle until something lands, type the words, export for the Instagram feed or a story. It composes type, colour and geometry inside rules, from a seed. It is not AI image generation.

## What it does today

A phone app in Simple mode: pick a style (Swiss, Postmodern, Brutalist, Vaporwave) and a format (1:1, 3:4, 9:16), Shuffle, lock palette, type, graphic or layout, edit title, subtitle, info and caption, Back, Keep into a Kept sheet, export JPEG or PNG at three sizes. Design, Back steps, Kept and locks are saved and survive reload. The engine lays out, builds a Scene and paints it, with checks for overflow, overlap and contrast. Eight palettes per style, each in light and dark (Light/Dark on the Look tab). 42 font pairings from Google Fonts, fetched on demand and cached (online lines not yet verified). Finish and Marks are in the spec but offer only Clean and Off until bundle 2; the Advanced switch shows Simple's tabs until bundle 3. `docs/design/refs/` shows the looks it targets.

## Where it is going

- **Four styles:** Swiss, Postmodern, Brutalist, Vaporwave.
- **Five finishes** over any style: Clean, Grain, Grunge, VHS, Glitch.
- **Marks:** an optional layer of small technical graphics (brackets, rulers, crosshair, barcode, micro labels).
- **Light and dark** for every palette; palettes you can edit and save.
- **Font pairings** from free Google Fonts, fetched online and cached, bundled in the APK; your own font files later.
- **Four text slots:** title, subtitle, info, caption, each on or off.
- **Three sizes** from one design: 1080 x 1080, 1080 x 1440, 1080 x 1920.
- **Simple and Advanced** modes on one switch.
- Then motion (MP4), then photos, uploaded assets and brand kits.

## Status

| Bundle | What | State |
|---|---|---|
| 1 | Engine, colour, type, frame and Simple mode | In progress: R1 to R4 done, viewer check next |
| 2 | Swiss and Postmodern finished, finishes, marks | Queued |
| 3 | Brutalist, Vaporwave, Advanced mode | Queued |
| 4 | My palettes, own fonts, retouch | Queued |

## How it is built

`docs/SPEC.md` is the app, `docs/RUN.md` is how a chat builds a row, `docs/BACKLOG.md` is the queue, `docs/CHANGELOG.md` is the record. `docs/archive/` keeps the plans and the spike.
