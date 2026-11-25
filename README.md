# RSTR

A poster generator for a phone. Pick a style, shuffle until something lands, type the words, export for the Instagram feed or a story. It composes type, colour and geometry inside rules, from a seed. It is not AI image generation.

## What it does today

A phone app in Simple mode: pick a style (Swiss, Postmodern, Brutalist, Vaporwave) and a format (1:1, 3:4, 9:16), Shuffle, lock palette, type, graphic or layout, edit title, subtitle, info and caption, Back, Keep into a Kept sheet, export JPEG or PNG at three sizes. Design, Back steps, Kept, locks and the Advanced switch are saved and survive reload. The engine lays out, builds a Scene and paints it, with checks for overflow, overlap and contrast. Eight palettes per style, each in light and dark (Light/Dark on the Look tab). 42 font pairings from Google Fonts, fetched on demand and cached (online lines not yet verified). Every style is built as five parts (ground, layout, type, graphics, palette) over one shared graphics library. Swiss is finished as built (row R5): eight layouts (graphic above, below, full bleed, a column band, type only, the title up the left edge, a text block low on a full field, a split field), twelve graphics, two positions for each text slot, a tilt or quarter turn about one roll in three with the title kept within 25% of its upright size in every layout and format (tested), small, normal or oversize titles, and a second graphic (sometimes a third) cut into the first; it passes the three variety tests in every format. Postmodern is built in both dialects (row R6), chosen by a Dialect control on the Look tab (Either, Ice cream, Photocopy; Shuffle keeps it). Ice cream: six layouts, thirteen shapes with hard shadows spread over the whole page and kept off the caption, five faint ground patterns, the title as tilted strips or as letters on tiles, the subtitle on one line where it fits (on two, never one word alone on the second). Photocopy: five layouts, every title word in its own face, size and case with colliding lines (a word too wide for the page runs off one side only, by at most 0.3 em), a boxed word, a ghost and a sliced word, four to six of ten found graphics, a paper edge round the title words (switchable in Advanced, which then waives their contrast check), and the copier pass over everything. Postmodern passes the variety tests counting both dialects, and each dialect alone the 60-shuffle test. Five finishes on the Look tab, over any style (row R7): Clean; Grain (film grain, a little vignette); Grunge (grain, dust, faint streaks, nibbled edges with bigger bites at the corners, a little ink spread on type); VHS (chroma bleed, scanlines, streak grain, a tracking band, head-switching noise) and Glitch (slices shifted with an RGB split, scanlines, corruption bars, one pixel-sort smear), which never touch text: it is drawn after the effect, and what the effect slides sideways is held under and round every letter, so a plate stays under its text. No finish takes any part of a text item under 3:1, nor a low-contrast photocopy word lower (a guard reads each item in cells and puts back any item it would). Style tiles draw without the finish. Marks on the Look tab: Off, Light (three or four small technical marks, each kind once, in free corners, edges and bands: rulers, crosshair, grid, brackets, barcode, status cells, slashes, dot matrix, micro labels, as each style allows) or Full (also the info slot in a chamfered card and an underline bar with a micro label under the title); marks never sit on text or on the plate or bar text is set on, keep off shapes where the page has bare room, and set their micro labels on one surface at 3:1 or more (a crosshair with no such room comes without its readouts); micro labels say only what the design holds (seed, format, style, palette, a counter, the app name). The Advanced switch shows Simple's tabs until bundle 4. `docs/design/refs/` shows the looks it targets.

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
- **Simple and Advanced** modes on one switch. Advanced has six tabs (Style, Layout, Graphic, Type, Colour, Text) built from each style's own controls, and a colour edit for the design in hand (3 to 5 colours, contrast repaired and warned). Shuffle clears hand-set values except for the facets you locked.
- **Mix (experimental):** crosses of two styles.
- Then motion (MP4), then the APK.

## Status

| Bundle | What | State |
|---|---|---|
| 1 | Engine, colour, type, frame and Simple mode | Done: R1 to R4 and the viewer check; R3's online lines open (H3) |
| 2 | Parts and variety, Swiss | Built: R13 (parts, variety engine) and R5 (Swiss finished); Pedro looks at Swiss before bundle 3 |
| 3 | Postmodern (both dialects), finishes, marks | Built: R6 (Postmodern) closed; R7 (finishes, marks) closed; bundle viewer check (fix) applied, bundle close next |
| 4 | Brutalist, Vaporwave, Advanced mode | In progress: R8 (Brutalist: eight layouts, size classes, a band of 12 blunt graphics, a free strip for marks) and R9 (Vaporwave: eight layouts, six new graphics, cut-ins, a sky title that reads in every palette; Shuffle no longer repeats one of the last 59 designs) and R10 (Advanced mode: six tabs generated from each part's controls, per-design colour edit, finish strengths, marks allowed) closed; the bundle viewer check is next |
| 5 | Photo and export, A3 print | Queued |
| 6 | Text layers, retouch | Queued |
| 7 | Mix | Queued |

## How it is built

`docs/SPEC.md` is the app, `docs/RUN.md` is how a chat builds a row, `docs/BACKLOG.md` is the queue, `docs/CHANGELOG.md` is the record of what changed, `docs/PROCESS.md` the record of how each chat went, `docs/reviews/` every review. `docs/plan.html` is the plan as a page (open it in a browser; it has a live demo of the spike). `docs/archive/` keeps the first plan and the spike.
