# RSTR spec

Settled on 23 Nov 2026, revised the same evening (plug and play, variety, photo, print, text layers, mix). A builder follows this; a reviewer checks against it. Where it is silent, take the most reasonable reading and record the choice in the changelog.

## 1. What it is

A poster generator for a phone. Pick a style, tap Shuffle until something lands, type the words, export. The app composes type, colour and geometry inside a style's rules; a seed makes each result reproducible.

- **User:** Pedro only. Android phone, Chrome, portrait.
- **Form:** a web app on GitHub Pages, later the same code in a Capacitor APK.
- **This spec: stills**, including one uploaded photo and print-size export. Motion comes after (section 11, outline only).
- **Plug and play.** Fonts, palettes, graphics and styles are fixed lists inside the app. Pedro never manages a library; he picks, shuffles, tweaks the design in front of him and exports.

## 2. What it is not

- **No AI image generation.** Nothing calls a model. No server, no key, no cost per image.
- **No figurative illustration.** Graphics are procedural: geometry, pattern, line, gradient, texture. The only picture is one photo Pedro uploads (8.9).
- **No free-form editor.** Nothing is dragged. Pedro chooses and tunes rules; the engine places things.
- **No licensed fonts.** Helvetica, Akzidenz and the like are never bundled.
- **No libraries to manage.** No font upload, no saved palettes, no brand kits, no import or export of designs as data.
- **No accounts, no sync.** Everything lives on the phone.

## 3. The design is data

A design is one JSON document, the **spec**. The image is never stored; it is drawn from the spec at any size.

```
{ "v": 1,
  "style": "swiss",              // swiss | pomo | brutal | vapor
  "mix": null,                   // null, or { "b": "vapor", "parts": { ... } } (8.8, experimental)
  "format": "3:4",               // 1:1 | 3:4 | 9:16 | A
  "mode": "light",               // light | dark
  "finish": "clean",             // clean | grain | grunge | vhs | glitch
  "marks": "off",                // off | light | full
  "seeds": { "layout": 1, "colour": 2, "graphic": 3, "type": 4 },
  "pick": { "palette": null, "colours": null, "pairing": null, "motif": null, "layout": null, "dialect": null },   // null = the seed decides; colours: { "light": { "ink": "#rrggbb", ... } } (5)
  "photo": null,                 // null, or { "id": "...", "treatment": null, "place": null } (8.9)
  "params": { },                 // Advanced values, per style; absent = the seed decides
  "text": { "title":    { "on": true, "v": "Signal and noise", "pos": null },
            "subtitle": { "on": true, "v": "...", "pos": null },
            "info":     { "on": true, "v": [ { "k": "Where", "v": "Lisboa" } ], "pos": null },
            "caption":  { "on": true, "v": "...", "pos": null } } }
```

- **Four seeds, four independent streams.** Layout, colour, graphic, type. Changing one never changes what the other three produce (tested, 9.3). This is what Lock and the per-facet rerolls rest on.
- **A pick overrides its seed.** `pick.palette` set means the colour seed is ignored for palette choice, and so on.
- **Format, mode, finish, marks, Postmodern's dialect (`pick.dialect`) and the photo itself are not seeded choices of Shuffle.** Shuffle never changes them; the dialect is a setting of the Look tab like Light/Dark (review R6 M1). Where the photo sits and how it is cropped is seeded (layout stream); its treatment is seeded (graphic stream).
- **The same spec draws the same design** on the same device and build (tested).
- A spec with an unknown field or an older `v` is migrated or the unknown part ignored; it never crashes the app.

### Formats

| Format | Pixels | Notes |
|---|---|---|
| 1:1 | 1080 x 1080 | |
| 3:4 | 1080 x 1440 | Default |
| 9:16 | 1080 x 1920 | Text stays between y 260 and y 1600: the top 250 px and bottom 320 px belong to the story interface. Ground, graphics and marks may fill them. Same zones Pedro has used on his story posts. |
| A | 1080 x 1527 on screen | The paper ratio, 1 to root 2. Prints as A5, A4 or A3. Print export is section 10.1 |

One spec, every format: the same palette, pairing, motif and words, laid out again for the ratio. It should read as one design in four sizes, not four designs.

## 4. The engine

Three stages, each a pure function, all in `src/engine/`:

1. **layout(spec, measure) -> Scene.** Decides everything: boxes, font sizes, line breaks, colours, which graphics go where. A Scene is plain data: a list of items (`text`, `graphic`, `rect`, `ground`), each with its box, plus the safe area.
2. **paint(ctx, scene, t).** Draws a Scene. No decisions, no randomness beyond what the Scene carries.
3. **finish(ctx, spec).** The texture pass of section 7.

- `t` is time for motion. Phase 1 always passes `null` (still). Every graphic's draw function takes `t` from the first row on, so phase 2 adds motion without rewriting them.
- **Layout is a solver, not a single shot.** It draws candidates from the layout stream and returns the first that passes the invariants of 9.2. A candidate that would overflow, overlap or fail contrast is discarded, not painted. If none of 20 passes, it returns the style's fallback layout, which must always pass.
- **Text fits.** A text item gets the largest size at which it fits its box within the style's limits; it never overflows, clips or shrinks below the style's minimum (then the candidate fails).
- **Spacing by ink, not by font box.** Vertical gaps are measured from real glyph bounds, so a big title has no dead air above it.
- **Export draws at full size** on an offscreen canvas after fonts are loaded. It is never a scaled copy of the preview.
- The app exposes `window.__rstr = { scene(spec), render(canvas, spec), spec() }` for the tools.

## 5. Colour

A **palette** is roles, not colours in fixed places:

| Role | Use |
|---|---|
| `ground` | Background |
| `ink` | Text and line |
| `accent` | The loud colour |
| `accent2`, `accent3` | Optional; styles that use many colours need them |
| `gradient` | Optional list of stops; Vaporwave grounds |

- **Every palette has a light and a dark form**, both written by hand in the data file. Dark is not an automatic inversion. Mode picks the form.
- **Contrast:** any text against what is directly behind it reaches 4.5:1, or 3:1 for text of 60 px and up at 1080 wide (tested, 9.2). A style may put a plate behind text to get there.
- Each style lists its palettes in `src/data/palettes/<style>.ts`, at least 8 each by the end of phase 1. The spike's palettes are the starting set.
- **Palettes are a fixed list.** Nothing is added, saved or deleted by the user.
- **Edit for this design (Advanced):** the three to five colours of the design on screen can be changed one by one. The edit is stored in that design's spec as `pick.colours` and nowhere else. Shuffle clears it unless Colour is locked. Kept designs keep theirs.
- An edited colour set must still pass contrast: the engine may swap a text item between ink and ground, or put a plate under it, to get there. If nothing passes, the text keeps its plate and the control shows a small warning; the edit is not refused.
- Built at R10: `pick.colours` holds the edits per mode (`{ "light": { "<role>": "#rrggbb" } }`), because each palette's light and dark forms are written by hand; Light/Dark shows the other form's own edits or none. The design's colours are the palette roles its Scene paints with before any edit (roles of one colour together), the five most used. The layout is solved with the palette's own colours, so an edit never moves a box; then every role colour is swapped for its edit. A repair uses only the design's own colours. Colours a style mixes from two roles (a faint pattern, photocopy contours and tape) keep the palette's mix.

## 6. Type

A **pairing** is `{ id, name, display, text, mono, notes }` naming font families and the weights used. The starting list is `docs/design/pairings.md`: 42 pairings across the four styles, with Swiss leaning on single grotesque families.

- **Free fonts only, a fixed list.** Families on Google Fonts, chosen in `pairings.md`. Nothing licensed is ever shipped or fetched, and there is no font upload.
- **Web app: fonts are fetched online, on demand.** Picking or shuffling to a pairing loads its families and weights from Google Fonts, and only those. A service worker caches every font file fetched, so a pairing used once works offline afterwards.
- **A core set is bundled** with the web app so it always draws, online or not: the eight families of the spike (Inter Tight, Bricolage Grotesque, Instrument Serif, DM Mono, Anton, Archivo Black, Unbounded, Silkscreen). Each style's default pairing uses only core fonts.
- **APK: every font of every pairing is bundled.** `tools/fetch_fonts.py` downloads them at build time; licence texts go to `public/LICENSES.txt`.
- **Never lay out with the wrong font.** Layout waits for the pairing's fonts. If they have not arrived in 4 s (offline, never cached), the design is drawn with the style's default pairing, a small note says so, and the spec keeps the pairing that was asked for. Shuffle prefers pairings whose fonts are already available when offline.
- Export waits for fonts the same way.
- Each style lists the pairings it allows. Swiss: grotesques, alone or with a serif for the subtitle. Brutalist: heavy display faces with a mono.
- The type seed picks the pairing; `pick.pairing` overrides it.
- Pairing lists found on the web (Typewolf and the like) are reading for whoever curates the file. The app fetches font files, never pairing data.

## 7. Finish and marks

### 7.1 Finish

A pass over the composed image. A finish is not a style: any style takes any finish.

| Finish | What it does |
|---|---|
| Clean | Nothing |
| Grain | Fine film grain, a little vignette |
| Grunge | Grain, photocopy dust, faint horizontal streaks, nibbled edges with bigger bites at the corners, slight ink spread on type |
| VHS | Chroma bleed, scanlines, streak grain, a tracking band, head-switching noise at the bottom |
| Glitch | Slice displacement with RGB split, scanlines, corruption bars, one pixel-sort smear |

- Recipes: `docs/design/elements.md`. Deterministic from the graphic seed.
- **Two passes for VHS and Glitch:** ground and graphics, then the effect, then every text item on top. These effects never touch text.
- **Grain and Grunge cover everything**, then the title is stamped again at part strength so its edges hold. No colour ghost on type.
- The contrast rule of section 5 is checked before the finish, and a finish never takes a text item under 3:1 (tested).
- When a finish other than Clean is on, text set in a light weight steps up one weight.
- Advanced has a strength dial per finish.

### 7.2 Marks

A layer of small technical graphics over any style: brackets, tick rulers, a crosshair, slashes, a barcode strip, status cells, micro labels, and containers for text (chamfered card, highlight bar, underline bar). The library is `docs/design/elements.md`.

- `marks`: off, light (three or four marks in free corners and edges), full (also the containers: info goes in a chamfered card, the title gets an underline bar and a micro label). A title set on its own plate (a Vaporwave window or band) takes no bar: the plate is its container (review R9 M7).
- Placed by the layout stream after text and graphics, in free space only. A mark never sits on a text item.
- Micro labels carry only what the spec knows (seed, format, style, palette, date, counter). Nothing invented that reads as a fact.
- Colours come from the palette roles. Each style may restrict which marks suit it; Swiss takes rulers, crosshair, grid and brackets, Brutalist takes barcode, status cells and slashes, Vaporwave and Postmodern take all.

## 8. Styles

A style is a rule set: its layouts, the graphics it allows, how it sets type, its grounds, its palettes and pairings. `docs/design/refs/` shows each.

Approved by Pedro on 23 Nov 2026: Swiss and ice-cream Postmodern as first shown, then the variety pass on Swiss and the photocopy dialect of Postmodern (`refs/v2-*.jpg`, "this is it"). Those files are the target. Brutalist and Vaporwave refs are a first pass he has seen but not judged.

### 8.0 Variety, every style, every level

The first spike drew one kind of composition per style. That is not enough. These rules bind all four styles.

**Layout**
- At least 8 named layouts per style.
- **Transforms** on top of a layout: a tilt of the whole composition (9 to 14 degrees either way) and a quarter turn (the layout drawn sideways, read from the edge), each on roughly one roll in six where the style allows it. Brutalist and Postmodern also turn single text items.
- **Depth:** ground, back graphics, front graphics, text. Items overlap across layers and bleed off the canvas. A composition that sits politely inside its margins is one option among several, not the rule.
- **Title size classes:** small, normal, oversize, chosen by the layout stream; each style sets what those mean.

**Graphics**
- At least 12 graphics per style, drawn from one shared library; a style lists the ones it allows.
- Every graphic has at least three parameters with wide ranges (scale, weight, density, angle, count). Ranges go to the extremes: dots from a fine screen to a few huge discs, contour lines from hairline to thick bands, lines from pinstripe to slab.
- **Combination:** about six rolls in ten cut a second graphic into the first, as a disc, a column, a band or inside a block, on a plate of ground, ink or accent. About one in ten adds a third. Topo with dots, lines with solid shapes, bars inside a disc.
- A graphic may be drawn in ink, accent, a second accent or ground, positive or reversed.

**Proof of variety (tested)**
- In 60 consecutive shuffles of one style in one format, no two designs share layout, transform, first graphic, second graphic and palette. Drawn independently, these repeat about once or twice in any 60 for every style, so Shuffle holds the rule: a design whose five repeat one of the session's last 59 shuffles of that style and format is drawn again, up to 8 times. The test runs 20 windows of 60 from different seed bases, each format from its own (review R9 S1).
- In 300 shuffles, every layout, every graphic, every palette and every pairing of the style appears at least once.
- No single layout takes more than 25% of 300 shuffles.

### 8.1 Swiss

After Müller-Brockmann. The grid is the design.

- 6 columns, one margin (72 px at 1080), one rhythm unit between everything.
- Flush left, ragged right, sentence case as typed. One grotesque family, heavy for the title, regular for the rest. Tight tracking on the title.
- One accent, used boldly: a full field, a huge disc, a plate. Ground, ink, accent, and at most a second accent.
- Title and subtitle share an axis that sits on a column line (column 0, 1 or 2). Info is up to three label/value columns on the same axis, above a rule; caption under the rule, small, tracked, upper case.
- Layouts: graphic above, graphic below, full-bleed graphic with a ground-colour plate for text, graphic as a column band beside the text, type only, title vertical up the left edge, text block centred low on a full field, split field (two colours meeting on a column or row line).
- Graphics: topo, blocks, bars, dots, disc, lines (weight progressions), rules, numeral (one huge figure used as a shape), crosshairs, grid, rings, waves.
- The variety pass in the spike (`docs/archive/spike/engine.js`: `swiss`, `swissCore`, `lines`, the combination block) is the reference for tilt, quarter turn, combination and ranges. Known weakness to fix: a tilted layout shrinks its text block; keep the title at a readable size by letting graphics, not text, pay for the tilt.

### 8.2 Postmodern

Two dialects in one style. The layout stream picks one unless `pick.dialect` is set. Simple mode shows a Dialect control (Either, Ice cream, Photocopy) on the Look tab when the style is Postmodern.

**Ice cream.** Memphis and new-wave energy. Loud, tilted, layered, friendly.

- Ground with a faint pattern: dots, grid, confetti, and two more.
- Five to eight shapes on a jittered lattice, each rotated, each with a hard offset shadow in ink: striped block, half disc, triangle, squiggle, dot square, stairs, ring, checker, arc, zigzag band, pill, cross, wedge.
- Title in upper case, one tilted strip per line, each strip a different fill, strips stepping sideways, hard shadow. A second treatment: letters on separate tiles.
- Subtitle in serif italic on a highlight plate, tilted the other way. Info in mono inside a bordered box with a shadow. Caption in mono running up the left edge.
- Three accents plus ink and ground. Shapes may sit behind text plates; they never sit on top of text.

**Photocopy.** Nineties magazine grunge: cut, paste, copy, copy again. `refs/v2-grunge-*.jpg`, spike function `grunge`.

- Paper, ink and one spot colour (or none).
- **Every title word gets its own face, size and case** from the pairing's display, serif and heavy faces. Negative leading so words collide. One word is sliced and its halves offset, one sits in an ink box, one has a ghost copy in the spot colour. Words may run a little off the canvas.
- Found graphics underneath, four to six of: halftone disc, ink slab, scribble, tape strips, X marks, faint contours, line blocks, torn edge, registration marks, a redacted bar.
- Subtitle on cut-out paper strips, two words each, stepping across. Info on a paper label with a heavy top edge. Caption repeated three times, fading.
- **The copier pass is part of the dialect**, not a finish: grain, dust, streaks, dark edges, raised contrast, over everything including type. A finish may be added on top.
- **Readable by default:** title words carry a paper-coloured edge so they hold over ink. Advanced has a Paper edge switch; with it off, invariant 4 of 9.2 is waived for title words in this dialect only. That is the rougher, truer look, and Pedro's to choose.

### 8.3 Brutalist

HEAVY TYPE. The title is the graphic.

- Upper case. One word per line up to four words, otherwise three balanced lines. **Every line is scaled to fill the full width**, then the whole block is stretched vertically to fill the height it has (0.55 to 1.9 times). Stretched type is the point. Where those lines at full width cannot fit the height even at 0.55, words join onto fewer, balanced lines (each still full width) rather than any line shrinking off the width; a typed line break is kept as typed (R8, review R1 M4).
- Title size classes (R8): the title takes about half (small, stretched nearer 0.55), seven tenths (normal) or all (oversize) of its area, and the band of blunt graphics takes the rest. In every class the band takes only height the title's own lines (one word per line) do not need at 0.55: where that leaves no band, the band is thin or absent, never bought by joining words. Words join only where the area is too low for those lines in any case (the line above); a thin band may then still run, except at oversize (review R8 S2).
- One line sits on a full-bleed accent bar.
- Thick rules. Caption in mono in a strip between rules at the top with a small format tag at the right. Subtitle in mono inside a solid ink bar. Info as a table: one row per pair, label left in mono, value right in the heavy face, a rule between rows.
- Narrow margin (about 48 px at 1080). Two colours and one accent. No decoration.
- Left-over space gets blunt graphics: barcode stripes, an accent slab with a disc, a row of asterisks, an arrow, a huge numeral, and the shared library drawn at its heaviest settings. The huge numeral is at least a quarter of the canvas width tall: where the band, or the box a cut-in would give it, cannot hold one that large, another blunt graphic is drawn instead (a numeral picked by hand is drawn as picked; review bundle 4 S2). A band taller than the title takes its first graphic alone, with no cut-in, unless Advanced sets the cut-ins or picks the second (review bundle 4 S4; the share of designs with a cut-in stays about six in ten, 8.0).
- Layouts beyond the first: title set at 90 degrees up the edge, title cropped by the canvas edge (Advanced only, off by default), boxed variant with a full border, title split across top and bottom with the table between, one word per screen-filling line with the rest tiny, table-first with the title as the last row. Built at R8: title-top, title-bottom, table-first, split, boxed, title-up, screen, slab (a big band of graphic bleeding off both sides, the title under it). The cropped title is not built yet: a title cut by the canvas breaks rule 1 of 9.2, and Advanced has no control for it until R10.
- With marks on (7.2), a strip at the canvas's top and bottom edges (the sides on a quarter turn) is kept free for them; otherwise the page fills to its margins.

### 8.4 Vaporwave

- Gradient sky, horizon between 56% and 64% of the height, a sun with slits that widen downward, a perspective grid floor with a glow, sparkle stars.
- Title in a wide heavy face, upper case, centred: gradient fill split at the middle like chrome, a light outline, two offset copies in accent colours.
- Subtitle in wide-tracked upper case. Info in a plain window with a title bar and three squares, pixel face inside. Caption centred at the bottom in mono.
- More: wire sphere, checker floor, floating window stack, gradient bars, horizon mountains as a polyline, layouts with no horizon at all (windows on a gradient field; a grid tunnel; the sun huge and cropped), the title in the sky, on the floor or inside a window.
- No statues, palms, logos of old software or Japanese text set for effect. A photo Pedro uploads may stand in.
- Light mode is a pastel sky with dark ink.
- Built at R9: eight layouts. With a horizon: title-sky (title and subtitle in the sky over the sun, the info window on the floor), title-floor, title-window (the title inside a window across the sky), title-band (the title on a band of window colour across the horizon). Without one: windows (a stack of windows on a gradient field, the title in the front one, the caption on a bar), tunnel, sun-huge (cropped by the top or bottom edge), orb (a wire sphere). A horizon stays level; the four layouts without one take a tilt or a quarter turn about one roll in six each.
- Sky title, legible on every palette (R9): in every form of every palette, ink or window ink holds 3:1 on the top 60% of the sky and 4.5:1 on the top 48%, so sky text stays above 47% of the horizon height and the sun is sized to sit under it, never behind it. The block sits at the foot of that box and the sun comes up close under it; the spare sky is above the title (review R9 S5). The sun is the one graphic that does not keep a halo off the type; layout keeps type off it. The outline stays the ink that carries the title (rule 4 reads it); the echoes are the title's own.
- Graphics: the first graphic with a horizon is the thing in the sky (the slit sun, a wire sphere, or rings, dots, gradient bars, a checker or waves cut into a disc), the second the floor (grid, checker, waves, dots, rings); without a horizon the layout's own (window stack, tunnel, huge sun, orb) and a second from its list. Stars, the horizon glow, mountains and gradient bars come on top (mountains only on a horizon, never as the second of a layout without one: review bundle 4 M4); gradient bars behind the sun run across, thinning toward the horizon. As 8.0 binds: about six rolls in ten cut a further graphic into the focus disc, and about one in ten a third, a smaller disc inside that one. Advanced keys `vapor.first`, `vapor.second`, `vapor.extras` (0: no mountains or bars) and `graphics.cut` (0, 1 or 2 cut-ins, as in Swiss and Brutalist) pin them; the refs use them. `vapor.first` applies with a horizon only (without one the layout fixes the first graphic); a picked motif (`pick.motif`) wins over `vapor.first` and `vapor.second`. All four belong to the Graphic facet: Shuffle and New graphic clear them unless Graphic is locked.

### 8.5 Text slots (until row R17)

Title, subtitle, info (up to three label/value pairs), caption. Each is on or off. An off slot gives its space back. With every slot off, the design is a background plate.

- Each style defines two or three positions per slot. The layout stream picks; `text.<slot>.pos` overrides (Advanced).
- A line break typed in the title is kept.

### 8.6 Text layers (row R17)

The four slots become a list Pedro edits.

```
"text": [ { "id": "t1", "level": "headline", "v": "Signal and noise", "on": true },
          { "id": "t2", "level": "subhead",  "v": "...", "on": true },
          { "id": "t3", "level": "data",     "v": [ { "k": "Where", "v": "Lisboa" } ], "on": true } ]
```

- **Levels:** headline, subhead, body, label, caption, data (label/value pairs). A layer has one level; changing it changes how the style sets it.
- Add, remove and reorder layers; up to 8. At least zero: no layers is a background plate.
- Each style maps every level to a treatment and to the places it may go. Two layers of the same level are set alike and kept apart.
- One headline is the anchor of the layout. With two, the first in the list leads.
- The solver and the invariants of 9.2 apply unchanged. If the layers cannot all fit legally, the lowest levels shrink first; nothing is dropped silently, and a layer that cannot fit is flagged on its row.
- A v1 spec migrates on load: title to headline, subtitle to subhead, info to data, caption to caption.

### 8.7 Parts

Every style is built as five parts behind one shared interface, from row R13 on:

| Part | What it decides |
|---|---|
| ground | What fills the canvas before anything else, and any pass that belongs to the surface (the copier pass, the sky) |
| layout | Where things go: boxes, transforms, depth |
| type | How each text level is set: face, case, size class, plates, tilt |
| graphics | Which graphics are drawn in the boxes layout gives them, with what parameters |
| palette | Roles and their light and dark forms |

- A style is a named set of five parts and nothing else. No part reads another part's internals; they meet only through the Scene.
- This is what the mix of 8.8 needs. It is required now because it is cheap while the styles are being finished and expensive afterwards.

### 8.8 Mix (experimental, Advanced only, row R18)

A cross of two styles: each part comes from one parent.

- `mix: { "b": "<style>", "parts": { "ground": "a"|"b"|null, ... } }`. A null part is decided by the layout stream, so each Shuffle is a different cross.
- Advanced, Style tab: Mix on or off, the second style, and a parent switch per part. Labelled Experimental. Not in Simple.
- The solver and invariants apply. A cross that cannot be drawn legally falls back to parent A's part for whichever part failed.
- Each pair gets a tuning pass. A pair that only makes mud is switched off in a table in the data, with a line in the changelog saying why.

### 8.9 Photo (rows R14, R15)

One photo per design, chosen from the phone. It never leaves the phone.

- Kept on the device (IndexedDB), scaled on import so its long edge is at most 5000 px, orientation corrected. The spec holds only its id.
- **Shuffle moves it.** The layout stream decides its role and crop: full-bleed ground; inside the graphic box; cut into a disc, column or band; tilted with the composition. Scale from fitting to 2.5 times, offset anywhere that keeps the box covered. Locking Layout holds role and crop.
- **Treatments,** picked by the graphic stream unless chosen: colour, monochrome, duotone (two palette roles), halftone, threshold, posterise (three to five palette colours), dither. Each style lists the treatments it allows and its favourite. That list governs only the graphic stream's pick: a treatment picked by hand (the Treatment tiles, `photo.treatment`) may be any of the seven, except posterise on a palette of fewer than three colours, where it is not offered.
- Finishes and the copier pass apply to the photo like any graphic.
- **Text over a photo** sits on a plate or a scrim unless the measured contrast against the actual pixels behind it passes section 5.
- **It shows** (review R14 S1). Wherever it sits, at least 35% of the photo's box shows once text, plates and the graphics over it are drawn (read on the Scene: text, plates, fields and graphics on a plate cover it, an open graphic counts as half, the copier pass is a surface, not a cover; the smoke reads it on pixels). A placement that shows less tries the next placement of its role, then the next role from the layout stream; where none does (a role pinned in Advanced, or a page full of type) the placement that shows most is drawn. `ground` lies over every ground-layer item and every field or graphic that covers more than 80% of the canvas, and, as its second placement, over every field.
- Graphics still draw: a photo is one more graphic the combination rule of 8.0 can use, not a replacement for them.
- Print: a photo smaller than the export needs is drawn anyway; the export sheet says how many pixels it has against how many the size wants.

## 9. Proof

### 9.1 Scripts

- `npm run check`: types, unit tests (seeded generator, palette contrast maths, spec migration, stream independence on a stub measure), build.
- `npm run smoke`: headless Chrome on the built app. Walks every tab in both modes at 360 x 640 and 412 x 915, taps Shuffle, exports, and runs 9.2 and 9.3.
- `npm run sheet`: contact sheets to `shots/`: per style, 12 designs across the four formats, in light and dark, plus one sheet per finish. Also saves every screen of the app.

### 9.2 Invariants, checked on the Scene

For every style x format x mode, over 200 seed sets, with short, typical and long text (title of 1 word, 3 words, 8 words; every slot on, and each slot alone):

1. No text item leaves the canvas or, in 9:16, enters the story zones.
2. No two text items overlap.
3. No graphic is drawn over a text item (a plate under text is fine).
4. Every text item meets the contrast rule of section 5.
5. No text item is below its style's minimum size.
6. The export is a JPEG, PNG or WebP of exactly the format's pixels.

Any failure prints the spec that caused it, so it can be opened in the app.

### 9.3 Determinism

- The same spec drawn twice gives identical pixels.
- Changing only the colour seed leaves every box in the Scene where it was. The same for the type seed against graphics, and the graphic seed against text boxes.

### 9.4 Variety, photo, export

- The three variety tests of 8.0, per style.
- Photo: with a test photo, 9.2 passes in every role and treatment; text over the photo passes contrast measured on pixels (tested); the same spec and photo give identical pixels (tested).
- Export: every size and file type gives a file of exactly the stated pixels (tested); the A3 print size completes in headless Chrome and its time and peak memory are recorded.

### 9.5 What the scripts cannot say

Whether it looks good. The reviewer looks at the sheets and lists seeds that are legal but clumsy (dead space, a cramped title, a graphic that fights the text). Pedro has the last word.

## 10. Screens

### 10.1 The frame

Same on every tab, both modes, nothing scrolls:

1. **Header:** RSTR wordmark, the seed as a chip (tap copies it), Kept, the Simple/Advanced switch.
2. **Stage:** the design, as large as fits.
3. **Format** (1:1, 3:4, 9:16, A) and, once motion exists, Still/Motion.
4. **Locks:** Layout, Colour, Graphic, Type. A locked facet survives Shuffle.
5. **Panel:** the current tab's controls, fixed height, page chips when they do not fit.
6. **Action row:** Back, Shuffle (the big one), Keep, Export.
7. **Tab bar.**

- **Shuffle** makes new seeds for every unlocked facet and clears that facet's picks, except `pick.dialect`, which Shuffle keeps (spec 3).
- **Back** returns to the design before the last change; 30 steps are kept.
- **Keep** saves the spec to Kept. Kept is a sheet of thumbnails; tap opens one, hold deletes.
- The current design, Back steps and Kept are saved on the phone and return on reload.
- Controls at least 48 px. Text on a tile or button never wraps and never overflows: it shrinks to fit, then shortens.
- Look of the app: dark and quiet so the poster is the only colour on screen. `docs/design/refs/ui-*.jpg` is the reference. DM Sans only, bundled. Material Symbols outlined as SVG for icons.

**Export sheet (row R16 completes it)**

| Choice | Options |
|---|---|
| Formats | Any of 1:1, 3:4, 9:16, A; the current one is ticked |
| Size | 1x (1080 wide), 2x (2160), 3x (3240). For A also Print: A3 at 300 dpi, 3508 x 4961 px, which prints A4 and A5 too |
| Bleed | Print only: off, or 3 mm each side (3579 x 5032 px). Ground and bleeding graphics extend into it; text does not move |
| File | JPEG (quality 0.92), PNG, WebP |

- Save (download) and Share (the system share sheet with the files, shown only where the browser supports sharing files). Names: `rstr-<seed>-<format>-<width>.<ext>`.
- Every size is drawn at that size from the spec, never scaled up from a smaller canvas. Finishes are generated at the export size so grain stays fine.
- **Big renders:** if a canvas of the asked size cannot be made on the device, the engine draws it in horizontal strips and joins them. If that fails too, the sheet says which sizes this phone cannot make and offers the largest that works. Never a silent smaller file.
- Colour is sRGB. The sheet says so beside Print, with one line: saturated colours print duller than they look on screen.
- Before R16 the sheet had formats, JPEG or PNG, at 1x.
- Built at R16. Print is A3 and takes the A format alone: ticking another format moves the size to 3x. The A3 trim is the 1080 x 1527 Scene drawn at 3508 x 4961 (3.248 across, 3.249 down). The bleed's 71 px each way are 35 on the left and top and 36 on the right and bottom, filled with the trim's own edge mirrored outward, so ground, graphics and finish run past the trim and nothing on it moves. Every size is the Scene drawn through a transform at that size, so finishes, the copier pass and a photo's treatment run on the export's own pixels. From 2x up, vector drawing is done in bands of 512 rows, because Chrome cuts a path where its drawing area ends and the cut edge can land up to a pixel off. A strip render keeps one band and draws one more above and below. Its strips are joined into one canvas where one of the size can be made (any file type), or written straight into a PNG where none can. JPEG and WebP need a canvas of the whole size: where none can be made, the sheet greys those sizes and says PNG may. The sheet's photo line gives the photo's pixels against the size it is drawn at in the file.

### 10.2 Simple

For zero-thinking use. Four tabs.

| Tab | Controls |
|---|---|
| Style | The four styles as tiles, each tile a small live render |
| Text | Slot or layer rows: name, field, on/off (from R17: add, remove, level) |
| Look | Light/Dark, Finish, Marks, Dialect where the style has one, and four reroll buttons: New layout, New colours, New graphic, New type; page chips if it does not fit one page |
| Photo (R14) | Add or change, Remove, Treatment tiles, New crop |

### 10.3 Advanced

Everything Simple has, plus the parameters. Seven tabs: Style, Layout, Graphic, Type, Colour, Text, Photo.

| Tab | Controls |
|---|---|
| Style | Style tiles, Finish with a strength dial, Marks with a picker of which marks are allowed, Light/Dark; second page: Mix (R18) |
| Layout | Layout picker (the style's layouts by name), transform (none, tilt, quarter turn), margin, graphic share, title size class, axis column or tilt or horizon (whatever the style has) |
| Graphic | First and second graphic pickers, how the second is cut in, density, scale, line weight, angle, New graphic |
| Type | Pairing picker, title case (as typed, upper, lower), title weight where the family has it, tracking, size cap |
| Colour | Palette picker; the design's three to five colours, each editable for this design only |
| Text | Each slot or layer: field, on/off, position, and from R17 level, add, remove, reorder |
| Photo | Role, scale, offset, treatment and its parameters (duotone roles, halftone screen, threshold level) |

- Every Advanced control writes a `pick` or a `params` value. A value set by hand survives Shuffle only if its facet is locked; otherwise Shuffle clears it.
- A style shows only the controls it has. Controls are generated from the parts' parameter lists, not written per style.
- Built at R10. Keys: `layout.transform`, `layout.size`, Swiss `layout.axis` and `layout.flag` (where the layout reads them), Swiss `layout.share` (the graphic's share in graphic-above and graphic-below, 0.6 to 1 of the style's own; Brutalist's band is set by its size class, 8.3), Vaporwave `layout.horizon` (with a horizon, 0.56 to 0.64 of the height), Postmodern's dialect; `pick.motif` (the first graphic), Vaporwave `vapor.first`, `vapor.second`, `vapor.extras`, `graphics.cut`, Swiss and Brutalist `graphics.second` and `graphics.cutShape` (the first cut-in's graphic and its shape; picking one cuts one in), and `g.<graphic>.<param>` for each graphic the design draws (a Tune stepper picks whose); `pick.pairing` by full name, `type.case` (Swiss), `type.track` (Swiss, the title's tracking, -0.06 to 0.04 em), `type.cap` (0.6 to 1, every style whose type reads the size cap: not Brutalist), the Paper edge (photocopy); `pick.palette` and `pick.colours`; `text.<slot>.pos` (Swiss, Postmodern); `finish.<name>.strength` and `marks.no.<kind>` (which marks are allowed); from R15 `photo.treatment` and the treatment's parameters `photo.duo` (the two roles), `photo.contrast` (mono), `photo.screen` and `photo.angle` (halftone), `photo.level` (threshold), `photo.levels` (posterise) and `photo.dot` (dither), each offered for the treatment drawn. Facets: `layout.*` and the positions are Layout's, `g.*`, `graphics.*`, `vapor.*`, `photo.treatment` and the `photo.*` treatment parameters Graphic's (the photo's role, scale and offset are Layout's), and a style change clears the treatment and its parameters, `type.*` and the Paper edge Type's, the colours Colour's. The finish strength and the marks allowed belong to no facet: Shuffle keeps them, as it keeps the finish and the marks (spec 3). A choice of up to four options is a row of segments with Auto first; a longer one is a stepper, which shows what the design draws while it is unset. A control is shown only on a design it changes: a part names the ones its design ignores, and the size class and size cap, whose effect hangs on how the text fits, are tried with the fonts in use. A transform a layout's rules refuse is not offered there. Open items of this table are in Carried (`docs/BACKLOG.md`, R10 from R10).

## 11. Later, outline only

Each needs a Fable chat to specify before it is built.

- **Motion:** a device test of MP4 export first (WebCodecs with an MP4 muxer; MediaRecorder as the fallback), then entrances and loops per style, 6 s default, 30 fps, silent. The motion vocabulary to start from is at the end of `docs/design/elements.md`.
- **The APK.**
- **More styles:** Bauhaus, Constructivist, Y2K. Not before the first four hold up.
