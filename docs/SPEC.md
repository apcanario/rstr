# RSTR spec

Settled on 23 Nov 2026, revised the same evening (plug and play, variety, photo, print, text layers, mix). Revised 27 Nov 2026 by a design chat: the finishes retouched (7.1), Swiss and Brutalist as the prime styles, each with dialects (8, 8.0, 8.1, 8.3), 80 pairings with roles (6), palettes that serve every dialect (5), the Elements filter (8.0), the cropped-title waiver (8.3). A builder follows this; a reviewer checks against it. Where it is silent, take the most reasonable reading and record the choice in the changelog.

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
- **Format, mode, finish, marks, the dialect (`pick.dialect`: Postmodern, and from R24 and R26 Swiss and Brutalist), the Elements filter (`pick.elements`, 8.0) and the photo itself are not seeded choices of Shuffle.** Shuffle never changes them; the dialect and the filter are settings of the Look tab like Light/Dark (review R6 M1). A style change clears both. Where the photo sits and how it is cropped is seeded (layout stream); its treatment is seeded (graphic stream).
- **The same spec draws the same design** on the same device and build (tested).
- From row R17 the spec is `"v": 2` and `text` is the layer list of 8.6; the shape above is v1, which migrates on load.
- From row R24 the spec is `"v": 3`: `pick` gains `elements` (null, or a list of graphic ids), and `pick.dialect` takes a dialect of the design's own style (`icecream`, `photocopy`; `zurich`, `basel`, `programme`, `now`; `heavy`, `raw`, `neo`); an id of another style reads as null. A v2 design of Swiss or Brutalist migrates with `pick.dialect` set to `zurich` or `heavy`, the only manner those styles had, so a Kept design stays in its family. It is not promised the same pixels: new layouts, graphics, palettes and pairings join the rolls, as they did in every earlier row that re-recorded a style's snapshot. The row that lands v3 counts how many of the kept fixtures still draw the same Scene and records the number (settled 27 Nov 2026; Pedro may veto and ask for old designs to be frozen).
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
- The prime styles list at least 14 each (Swiss at R24, Brutalist at R26). Swiss gains among others a black and white with the accent equal to ink, a red ground, a black ground with one colour, and two ink pairs chosen to overprint well; Brutalist a plain black on white, a newsprint, a link blue on white, a terminal green on black, and three clashing sets for Neo.
- **A palette serves every dialect of its style**, so the colour seed never depends on the dialect (9.3). Every Swiss palette carries `accent2` and a `gradient` of two or three stops (used by the Now dialect only, 8.1); every Brutalist palette carries `accent2` and `accent3` (used by Neo only, 8.3). A dialect ignores the roles it does not use.
- **Mixed and blended colour.** Where the `overprint` graphic overlaps two flat shapes, the overlap is the two roles multiplied, as two inks would print; a `shade` runs between two roles. Both are mixed again from edited roles, like every mixed colour (below). Text over a blend, an overprint or a graded grid is read on pixels as text over a photo is (8.9), or set on a plate.
- **Palettes are a fixed list.** Nothing is added, saved or deleted by the user.
- **Edit for this design (Advanced):** the three to five colours of the design on screen can be changed one by one. The edit is stored in that design's spec as `pick.colours` and nowhere else. Shuffle clears it unless Colour is locked. Kept designs keep theirs.
- An edited colour set must still pass contrast: the engine may swap a text item between ink and ground, or put a plate under it, to get there. If nothing passes, the text keeps its plate and the control shows a small warning; the edit is not refused.
- Built at R10: `pick.colours` holds the edits per mode (`{ "light": { "<role>": "#rrggbb" } }`), because each palette's light and dark forms are written by hand; Light/Dark shows the other form's own edits or none. The design's colours are the palette roles its Scene paints with before any edit (roles of one colour together), the five most used. The layout is solved with the palette's own colours, so an edit never moves a box; then every role colour is swapped for its edit. A repair uses only the design's own colours. Colours a style mixes from two roles (a faint pattern, photocopy contours and tape, the photocopy info label's plate and the caption's two faded copies) are mixed again from the edited roles (R12).

## 6. Type

A **pairing** is `{ id, name, display, text, mono, notes }` naming font families and the weights used, plus the roles a style's dialects need (below). The list is `docs/design/pairings.md`: 42 pairings across the four styles at R3, with Swiss leaning on single grotesque families; 80 from row R21 (Swiss 32, Brutalist 32, Postmodern 8, Vaporwave 8).

- **Free fonts only, a fixed list.** Families on Google Fonts, chosen in `pairings.md`. Nothing licensed is ever shipped or fetched, and there is no font upload.
- **Web app: fonts are fetched online, on demand.** Picking or shuffling to a pairing loads its families and weights from Google Fonts, and only those. A service worker caches every font file fetched, so a pairing used once works offline afterwards.
- **A core set is bundled** with the web app so it always draws, online or not: the eight families of the spike (Inter Tight, Bricolage Grotesque, Instrument Serif, DM Mono, Anton, Archivo Black, Unbounded, Silkscreen). Each style's default pairing uses only core fonts.
- **APK: every font of every pairing is bundled.** `tools/fetch_fonts.py` downloads them at build time; licence texts go to `public/LICENSES.txt`.
- **Never lay out with the wrong font.** Layout waits for the pairing's fonts. If they have not arrived in 4 s (offline, never cached), the design is drawn with the style's default pairing, a small note says so, and the spec keeps the pairing that was asked for. Shuffle prefers pairings whose fonts are already available when offline.
- Export waits for fonts the same way.
- Each style lists the pairings it allows. Swiss: grotesques, alone or with a serif for the subtitle. Brutalist: heavy display faces with a mono.
- **A pairing serves every dialect of its style** (27 Nov 2026), so the type seed never depends on the dialect (9.3). A Swiss pairing may add `labels` (a mono, or the grotesque itself), `narrow` and `wide` (a second width of the same design, a companion family or a point on a width axis) and `serif`. A Brutalist pairing adds `plain`, the Raw dialect's face: Tinos, Arimo or Cousine (the free metric stand-ins for Times New Roman, Arial and Courier New), or a core face. A dialect uses the roles it needs; where a pairing lacks an optional role the dialect's rule says what stands in (8.1, 8.3). Only the faces the drawn dialect uses are fetched.
- **Weights on offer (R21).** `pairings.json` lists, per display family, every weight the family has. The title weight control (10.3, `type.weight`) offers them where the type part reads a weight (Swiss); a weight is fetched when picked, with the 4 s wait above.
- **Font files for the tools.** Google Fonts is not reachable from the build workspace; the npm registry is. From R21, `tools/fetch_fonts.py --from npm` takes the same faces from the `@fontsource/<family>` packages (the Google Fonts files, republished), accepting only packages whose metadata says `type: google`, and writes them where the app already looks (`public/fonts/gf/`, not committed). Check, smoke and sheet then run with every pairing's real fonts. The app itself still fetches from Google at run time, and the offline check against Google itself stays a by-hand item (H3). Nothing from npm ships in the web app; this is a tool, not a runtime dependency.
- The type seed picks the pairing; `pick.pairing` overrides it.
- Pairing lists found on the web (Typewolf and the like) are reading for whoever curates the file. The app fetches font files, never pairing data.

## 7. Finish and marks

### 7.1 Finish

A pass over the composed image. A finish is not a style: any style takes any finish.

| Finish | What it does |
|---|---|
| Clean | Nothing |
| Grain | Film grain that shows on the phone: a fine layer and a coarser clumped layer, strongest in the mid-tones, and a clear vignette |
| Grunge | A photocopy of the whole page: crushed tone, uneven toner, streaks and bands along the copier's feed, speckle and dropout, dust and hair, a dark shadow at the edges, ink spread on type. The nibbled edge is one small part of it |
| VHS | A worn tape: colour smeared and shifted sideways, heavy scanlines, streak grain, two or three tracking bands, a ghost, dropouts, lifted blacks, a tall head-switching band at the bottom |
| Glitch | Slice displacement with RGB split, scanlines, corruption bars, one pixel-sort smear |

- **Pedro's verdict on the finishes as R7 built them, 24 Nov 2026:** "The grunge only puts a black ragged border on the page, it's nothing like a photocopy. The grain could be stronger, the glitch is good, the vhs also could use more oomph." Grain, Grunge and VHS are specified again below (row R19). Glitch stays as R7 built it.
- The recipes are at strength 1 and 1080 px wide. Every length scales with the canvas width, so a 3x or A3 export looks like the stage; a finish is generated at the export size, never scaled up (10.1). Deterministic from the graphic seed. `docs/design/elements.md` keeps the older VHS and Glitch recipes; where they differ, this section wins.

**Grain.** R7 drew one layer of noise of up to 16 levels either way and a 16% vignette.
1. Fine noise: one value per pixel, up to 26 levels (of 255) either way, the same on the three channels.
2. Clumps: value noise on cells of 2.5 px, up to 14 levels either way.
3. Both are weighted by tone: full at mid-grey, falling to 0.6 at black and at white.
4. Vignette: the corners 24% darker, falling off with the fourth power of the distance from the centre.

**Grunge.** A copy, not a frame. In this order:
1. Tone: a contrast curve sends the lightest 12% of the range to paper and the darkest 14% to toner. Toner is not pure black (about 22 of 255) and paper is not pure white (about 240, leaning to the ground's hue). Colour keeps its hue and loses about a fifth of its saturation.
2. Uneven toner: low-frequency value noise (cells of about 180 px) lightens dark areas by up to 14% and darkens light ones by up to 5%, so solids are mottled.
3. Feed marks: the seed picks the feed direction, down or across the page. Along it, 5 to 9 streaks the full length of the page, 1 to 6 px wide, 6 to 14% darker or lighter. Across it, 2 to 4 bands 30 to 120 px deep, 4 to 7% darker or lighter.
4. Speckle and dropout: dark specks on light areas (about 0.6% of pixels, in clumps of 1 to 3 px) and pinholes of paper in dark areas (about 1.2%, 1 to 4 px), both denser inside the bands; and grain of up to 18 levels either way.
5. Dust and hair: 20 to 40 specks of 2 to 6 px; 1 to 3 hairs, curved strokes 80 to 300 px long and 1 to 1.5 px thick.
6. The edge: a dark shadow along one to three sides, 24 to 60 px deep and uneven, as if the lid stood open; and R7's nibbles at half their depth, never past the free distance to the nearest text.
7. Type: R7's ink spread, then the title stamped again at a lower part strength than Grain uses, so speckle and pinholes show inside the letters and their edges still hold.

- Grunge marks the inside of the page, not only its edge (tested, 9.4).
- **On the photocopy dialect**, which has its own copier pass (8.2), Grunge is the second generation of the copy: steps 1, 3 and 6 as written, steps 2, 4 and 5 at half. (R19 as first written said Grunge must not double the dialect's pass; settled 27 Nov 2026 as a second, lighter copy, since copying a copy is what the dialect is.)

**VHS.** R7's figures in brackets.
1. Colour: the colour of the picture, not its brightness, blurred 8 px sideways and shifted 4 px (red and blue moved 2 px apart, no blur).
2. Scanlines: every other row at 0.80 (0.90).
3. Streak grain: noise blurred 11 x 1 sideways, up to 45 levels either way (30).
4. Tracking: two or three bands 46 to 90 px deep, their rows jittered by up to 30 px, with 12% white noise (one band of 46 px, up to 14 px, 10%).
5. Ghost: a copy of the picture 10 to 14 px to the right at 12%.
6. Dropouts: 6 to 14 white dashes, 20 to 120 px long and 1 to 2 px tall.
7. Tone: blacks lifted to about 18 of 255; saturation up by a tenth.
8. Head switching: the bottom 56 px skewed by up to 90 px, with noise (36 px, up to 60 px).

- **Two passes for VHS and Glitch:** ground and graphics, then the effect, then every text item on top. These effects never touch text.
- **Grain and Grunge cover everything**, then the title is stamped again at part strength so its edges hold. No colour ghost on type.
- The contrast rule of section 5 is checked before the finish, and a finish never takes a text item under 3:1 (tested). A finish is built to hold that by itself: at strength 1 the guard puts back fewer than 5% of text items (tested, 9.4), so a design is never clean type on a dirty page.
- When a finish other than Clean is on, text set in a light weight steps up one weight.
- Advanced has a strength dial per finish, 0 to 1.5; unset is 1, the recipes above.

### 7.2 Marks

A layer of small technical graphics over any style: brackets, tick rulers, a crosshair, slashes, a barcode strip, status cells, micro labels, and containers for text (chamfered card, highlight bar, underline bar). The library is `docs/design/elements.md`.

- `marks`: off, light (three or four marks in free corners and edges), full (also the containers: info goes in a chamfered card, the title gets an underline bar and a micro label). A title set on its own plate (a Vaporwave window or band) takes no bar: the plate is its container (review R9 M7).
- Placed by the layout stream after text and graphics, in free space only. A mark never sits on a text item.
- Micro labels carry only what the spec knows (seed, format, style, palette, date, counter). Nothing invented that reads as a fact.
- Colours come from the palette roles. Each style may restrict which marks suit it; Swiss takes rulers, crosshair, grid and brackets, Brutalist takes barcode, status cells and slashes, Vaporwave and Postmodern take all.

## 8. Styles

A style is a rule set: its layouts, the graphics it allows, how it sets type, its grounds, its palettes and pairings. `docs/design/refs/` shows each.

**Swiss and Brutalist are the prime styles** (Pedro, 27 Nov 2026: "those should be the prime styles on the app. More fonts, more visual styles, more graphics, more emphasis on topographical element variety and styles, geometric compositions, geometric shaped gradients like the circle gradient grid"). They carry the most dialects, layouts, graphics, palettes and pairings, and come first on the Style tab: Swiss, Brutalist, Postmodern, Vaporwave. What each movement is, what was missing and where each rule below comes from: `docs/design/swiss-brutalist.md`. The six new dialects have no reference image: the first sheets of rows R25 and R27 are the first look, and Pedro judges them.

Approved by Pedro on 23 Nov 2026: Swiss and ice-cream Postmodern as first shown, then the variety pass on Swiss and the photocopy dialect of Postmodern (`refs/v2-*.jpg`, "this is it"). Those files are the target. Brutalist and Vaporwave refs are a first pass he has seen but not judged.

### 8.0 Variety, every style, every level

The first spike drew one kind of composition per style. That is not enough. These rules bind all four styles.

**Layout**
- At least 8 named layouts per style. A prime style has at least 18 across its dialects and at least 3 in each dialect (R24 to R27: Swiss 21, Brutalist 18 with `cropped`).
- **Transforms** on top of a layout: a tilt of the whole composition (9 to 14 degrees either way) and a quarter turn (the layout drawn sideways, read from the edge), each on roughly one roll in six where the style allows it. Brutalist and Postmodern also turn single text items.
- **Depth:** ground, back graphics, front graphics, text. Items overlap across layers and bleed off the canvas. A composition that sits politely inside its margins is one option among several, not the rule.
- **Title size classes:** small, normal, oversize, chosen by the layout stream; each style sets what those mean.

**Graphics**
- At least 12 graphics per style, drawn from one shared library; a style lists the ones it allows, and a dialect may narrow that list. A prime style lists at least 24.
- Every graphic has at least three parameters with wide ranges (scale, weight, density, angle, count). Ranges go to the extremes: dots from a fine screen to a few huge discs, contour lines from hairline to thick bands, lines from pinstripe to slab.
- **Combination:** about six rolls in ten cut a second graphic into the first, as a disc, a column, a band or inside a block, on a plate of ground, ink or accent. About one in ten adds a third. Topo with dots, lines with solid shapes, bars inside a disc.
- A graphic may be drawn in ink, accent, a second accent or ground, positive or reversed.
- A dialect may set its own share of cut-ins where its manner needs it; it says so (8.1 Basel and Programme).

**Construction (row R22)**
- **Progressions, not noise.** Where a graphic repeats an element, its sizes, weights, gaps, counts and angles step by a named progression: arithmetic, doubling (1, 2, 4, 8, 16), Fibonacci, or root two. Angles sit on a module: 11.25, 15, 22.5, 30 or 45 degrees. The graphic stream picks the progression and the module, and both are parameters of the graphic. Jitter is allowed only where a style asks for it (ice cream, photocopy). The model is Müller-Brockmann's Beethoven poster, built on a module of 11.25 degrees with arc widths that double.
- **Graded and blended.** *Graded* means a progression of size, weight or tint in flat steps; every style may use it. A *blend* is a smooth run of colour; only Swiss's Now dialect and Vaporwave may use it.
- Ten constructed graphics join the shared library:

| Graphic | What it draws | Ranges |
|---|---|---|
| `gradgrid` | A lattice of one primitive (disc, ring, square, triangle, cross, half disc, bar) whose size, weight or tint grades across the field: along an axis, from a corner, out from or in toward a focus, or in a wave. The circle gradient grid is this with discs | 4 to 40 columns; the smallest element may vanish, the largest may touch or merge with its neighbours |
| `shade` | A shaped gradient: one geometric shape (disc, ring, half disc, square, band, triangle, pill) whose fill runs from one role to another, straight at a module angle or radial. Five renders: steps, halftone (dots that grow), line screen (lines that thicken), dither (hard pixels in an ordered pattern), blend | Steps 3 to 9; screens from fine to a few huge dots or bars; a style lists the renders it allows |
| `arcs` | Concentric arcs about one centre, which may sit off the canvas; arc lengths counted in modules, widths by a progression | 4 to 16 arcs |
| `rays` | Lines or wedges from one point on an angular module, weights by a progression; a fan or a full turn | 6 to 64 |
| `quarter` | A grid of quarter and half discs, each cell turned by a rule: ordered, mirrored, by row, or by the seed | 2 to 12 cells across; one to three roles |
| `tri` | Triangles: one huge wedge, a row, a stack of chevrons or a tessellation, sizes by a progression | 1 to 80 |
| `steps` | Bars or blocks whose length, height or gap steps by a progression: stairs, a ramp, a skyline | 3 to 24 |
| `squares` | Squares nested or turning, each one a step from the last (inset by the progression, turned by the module) | 3 to 14 |
| `moire` | Two fields of lines or of rings laid over each other at a small angle (1 to 8 degrees) or with centres a little apart | Pitch from hairline to bar |
| `overprint` | Two or three large flat shapes (discs, squares, bands) that overlap; each overlap takes the mix of its two inks (5) | Overlap from a sliver to most of the shape |

**Topography (row R23)**
- Every graphic of the topo family reads one height field per design, made from the graphic seed, so a topo and a relief cut into it describe the same land.
- `topo` gains four parameters. **Render:** hairline; index (every fourth or fifth line heavier, as on a survey map); bands (alternate intervals filled); layers (each interval one step of a tint between two roles); dashed; dotted; hachure (short ticks down the slope). **Landform:** one summit, twin summits, a ridge, a basin, a saddle, a coast (one heavy shoreline and a flat sea), islands. **Interval:** 4 to 60 lines. **Crop:** from the whole massif to a close-up of three or four lines.
- Four graphics join the library: `ridges` (the field as stacked profile lines, each hiding the ones behind; 12 to 90 rows, height and weight to the extremes), `flow` (streamlines that follow the slope; count, length, weight), `relief` (the field as a dot screen, dot size by height or by slope: topo and dots as one graphic), `sections` (two to six cross-sections of the field as filled silhouettes on their baselines).
- No spot heights and no figures on a map: a number there would read as a fact (7.2).

**Elements (row R24)**
- `pick.elements` is null or a list of graphic ids from the style's list. With a list, the first, second and third graphic are drawn only from it. A list of one may cut the same graphic into itself with other parameters. A graphic that a layout fixes (a Vaporwave tunnel) stays.
- The control shows the style's graphics as families, each a tile that switches its members on or off: Lines (lines, rules, bars, steps, rays, moire), Dots (dots, gradgrid, relief), Topo (topo, ridges, flow, sections, waves), Circles (disc, rings, arcs, quarter), Shapes (blocks, squares, tri, shade, overprint, grid), Signs (numeral, arrow, crosshairs), and a family for whatever else the style lists. Advanced lists every graphic by name.
- It is a setting, not a pick: Shuffle and New graphic keep it and roll inside it (3). A motif picked by hand outside the list wins for that design. Pedro, 25 Nov 2026: choose which elements appear (only lines, only gradient polka dots, only topography, circles, arrows), then randomise and fine-tune inside that selection. Built for every style, since the control is generated from the style's own list.

**Proof of variety (tested)**
- In 60 consecutive shuffles of one style in one format, no two designs share layout, transform, first graphic, second graphic and palette. Drawn independently, these repeat about once or twice in any 60 for every style, so Shuffle holds the rule: a design whose five repeat one of the session's last 59 shuffles of that style and format is drawn again, up to 8 times. The test runs 20 windows of 60 from different seed bases, each format from its own (review R9 S1).
- In 300 shuffles, every layout, every graphic, every palette and every pairing of the style appears at least once.
- No single layout takes more than 25% of 300 shuffles.
- A style with dialects passes these counting every dialect, and each dialect alone passes the 60-shuffle test (as Postmodern has since R6). With an Elements filter on, Shuffle still redraws a repeat, but these tests are run with no filter.

### 8.1 Swiss

The grid is the design. A prime style. Four dialects in one style; the layout stream picks one (Zurich 40, Now 25, Basel 20, Programme 15 in 100) unless `pick.dialect` is set. The Look tab shows the Dialect control (Any, Zurich, Basel, Programme, Now). Until R24 Swiss was the Zurich dialect alone, on six columns, in flat colour; the three changes are settled here (27 Nov 2026).

**Every dialect**
- A grid of 4, 6, 8 or 12 columns, picked by the layout stream (6 about half the time; Advanced `layout.cols`), one margin (72 px at 1080; Advanced `layout.margin`, 0.5 to 1.5 of it), one rhythm unit between everything. Text and the edges of graphics sit on column lines.
- Flush left, ragged right. Never centred, never justified.
- One grotesque family. Ground, ink, accent, and at most a second accent.
- Graphics follow the progression rule of 8.0.
- Colour is flat. Graded grids, and `shade` in steps, halftone or line screen, are allowed everywhere; a blend only in Now.
- Graphics, 27: topo, blocks, bars, dots, disc, lines (weight progressions), rules, numeral (one huge figure used as a shape), crosshairs, grid, rings, waves, arrow, and from R22 and R23 gradgrid, shade, arcs, rays, quarter, tri, steps, squares, moire, overprint, ridges, flow, relief, sections. A dialect lists the ones it allows.
- Each dialect sets every text level of 8.6, passes 9.2 in every format with and without a photo, and gives Advanced its controls through its parts (10.3).

**Zurich.** After Müller-Brockmann. As built at R5, and wider.
- Sentence case as typed; about one roll in five the title is set all in lower case, as the Tonhalle posters are (the type stream decides; Advanced `type.case` overrides). Heavy for the title, regular for the rest. Tight tracking on the title.
- One accent, used boldly: a full field, a huge disc, a plate.
- Title and subtitle share an axis that sits on a column line (in the left half of the grid). Info is up to three label/value columns on the same axis, above a rule; caption under the rule, small, tracked, upper case.
- Layouts as built: graphic above, graphic below, full-bleed graphic with a ground-colour plate for text, graphic as a column band beside the text, type only, title vertical up the left edge, text block centred low on a full field, split field (two colours meeting on a column or row line).
- Four constructive layouts (R24). `diagonal`: the graphic is built on an axis of 30, 45 or 60 degrees across the whole page (bands, lines, steps or blocks running at that angle and bleeding off) while every text item stays level on the grid; this is not the tilt transform, which turns the text too. `centre`: one construction (arcs, rings, rays, squares, a disc) large on a grid crossing, bleeding off up to two edges, with the text small in one corner block. `bands`: the page divided into fields, across or down, whose depths step by a progression; one field carries the text, one or two a graphic. `corner`: the graphic grows out of one corner (arcs, rays, steps, quarter) and the text sits in the opposite corner block.
- All 27 graphics. Tilt and quarter turn as built.
- The variety pass in the spike (`docs/archive/spike/engine.js`: `swiss`, `swissCore`, `lines`, the combination block) is the reference for tilt, quarter turn, combination and ranges. Known weakness to fix: a tilted layout shrinks its text block; keep the title at a readable size by letting graphics, not text, pay for the tilt.

**Basel.** After Hofmann and Ruder: contrast is the method.
- Ground and ink, and the accent on one element at most. On a palette whose ground is the loud colour, the form is ink and the accent is not used.
- One element at giant size, everything else small; at least half the page is empty ground or one flat form.
- Title as typed, tight. No oversize class except where the layout says so.
- Layouts. `letter`: one glyph, the first letter or figure of the title, 0.9 to 1.6 times the page height, cropped by the canvas, as a form in ink or accent; the text block small beside it or on a plate over it. The glyph is a graphic, drawn in a bundled core face chosen by the graphic seed, so the type seed does not move it (9.3). `contrast`: the title oversize across the top or bottom third, every other layer at its smallest in the far corner, the rest empty; one small graphic at most. `counter`: one flat form (disc, half disc, wedge, block, quarter) takes 45 to 70% of the page in ink; the title is reversed out of it and the other layers sit on the ground.
- Graphics: disc, blocks, quarter, tri, lines, rings, squares, steps, numeral, and shade in halftone or line screen. It is the quiet dialect: a second graphic is cut in about three rolls in ten, never a third (an exception to 8.0).
- No tilt. A quarter turn about one roll in six.

**Programme.** After Gerstner: the rule is shown.
- The grid is visible: hairline column and row lines over the page, or ticks at the margins.
- **Series.** The picture is a permutation: a strip or matrix of 3 to 36 cells, each cell the same graphic with one parameter stepped by a progression (turn, scale, weight, count, cut). Any graphic of the Swiss list can be the subject. The graphics part builds the series from the library; it is not a new library graphic. A series takes the place of cut-ins (an exception to 8.0); the accent marks one cell, the exception in the row.
- Type is small and even: no oversize class, all lower case, labels in the pairing's `labels` face, tracked. A cell may carry its index (01, 02, ...) as a micro label, which is a fact of the design (7.2).
- Layouts. `matrix`: cells in rows and columns over 55 to 75% of the page, the text in a block of the same grid. `strip`: one row or column of 3 to 8 cells across the page, text above and below on the same columns. `modules`: the page in tiers divided into 1, 2, 3, 4 and 6 columns, as Gerstner's grid divides; a tier holds text, a graphic or flat colour.
- No tilt, no quarter turn: the grid stays level.

**Now.** Contemporary Swiss: the same grid, louder means. Less of this dialect rests on a source than the other three (`swiss-brutalist.md` 1.1); it is the one most likely to need Pedro's notes.
- Blends are allowed: `shade` in its blend render and the palette's `gradient` stops, always inside a geometric shape or a grid field, never as the whole ground.
- Width contrast: the pairing's `narrow` and `wide` against each other in one title (alternate lines, or one word wide); where the pairing has neither, the display weight against the text weight.
- Labels in the `labels` face, small, upper case, tracked, with arrows. A hairline frame one margin in from the edge on about half the designs.
- Title as typed or upper case (type stream), very tight.
- Layouts. `edge`: the title set to the full measure at the top or bottom edge, as large as fits, a shaped gradient or graded grid filling the rest, labels in a row at the other edge. `orbit`: one large disc, ring or arc construction off centre, small labels on the grid around it tied to it by hairlines, the title at normal size. `ticket`: a framed grid of fields like a form: labels with arrows, one info layer per field, the title in the largest field, a graded grid in another.
- Graphics: gradgrid, shade, arcs, rings, disc, dots, relief, topo, ridges, flow, arrow, numeral, lines, quarter, overprint, moire.
- No tilt. A quarter turn about one roll in six.

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

HEAVY TYPE. The title is the graphic. A prime style. Three dialects in one style; the layout stream picks one (Heavy 50, Raw 25, Neo 25 in 100) unless `pick.dialect` is set. The Look tab shows the Dialect control (Any, Heavy, Raw, Neo). Until R26 Brutalist was the Heavy dialect alone.

**Every dialect**
- Type is the mass of the page. Clean edges: texture and distress are a finish (7.1) or Postmodern's photocopy dialect, never this style.
- No blend, no blur, no soft shadow, no rounded corner (Neo's pill excepted). Pedro asked for geometric gradients on 27 Nov 2026 and the movement rejects smooth ones; settled as: graded grids, and `shade` in steps, halftone, line screen or dither, never its blend render.
- Narrow margin (about 48 px at 1080; Advanced `layout.margin`, 0.5 to 1.5 of it).
- Graphics, 24: barcode, slab, asterisks, arrow, numeral, bars, lines, rules, dots, blocks, disc, lattice, and from R22 gradgrid, shade, arcs, rays, quarter, tri, steps, squares, and four of its own built at R26: `hazard` (stripes at 45 degrees, from pinstripe to slab, as a band, a block or a border), `cells` (an exposed grid: bordered cells or column lines across a box, borders 2 to 14 px, some cells filled), `placeholder` (a bordered box crossed corner to corner, the empty picture of a wireframe; one to six, any proportion), `burst` (a star badge of 8 to 32 points, solid or outlined). Shared graphics are drawn at their heaviest settings. A dialect lists the ones it allows.
- "Two colours and one accent. No decoration" binds Heavy and Raw. Neo takes three accents, outlines and hard shadows; that is its manner, settled here.
- Each dialect sets every text level of 8.6, passes 9.2 in every format with and without a photo, and gives Advanced its controls through its parts (10.3).

**Heavy.** As built at R8, and wider.
- Upper case. One word per line up to four words, otherwise three balanced lines. **Every line is scaled to fill the full width**, then the whole block is stretched vertically to fill the height it has (0.55 to 1.9 times). Stretched type is the point. Where those lines at full width cannot fit the height even at 0.55, words join onto fewer, balanced lines (each still full width) rather than any line shrinking off the width; a typed line break is kept as typed (R8, review R1 M4).
- Title size classes (R8): the title takes about half (small, stretched nearer 0.55), seven tenths (normal) or all (oversize) of its area, and the band of blunt graphics takes the rest. In every class the band takes only height the title's own lines (one word per line) do not need at 0.55: where that leaves no band, the band is thin or absent, never bought by joining words. Words join only where the area is too low for those lines in any case (the line above); a thin band may then still run, except at oversize (review R8 S2).
- One line sits on a full-bleed accent bar.
- Thick rules. Caption in mono in a strip between rules at the top with a small format tag at the right. Subtitle in mono inside a solid ink bar. Info as a table: one row per pair, label left in mono, value right in the heavy face, a rule between rows.
- Two colours and one accent. No decoration.
- Left-over space gets blunt graphics: barcode stripes, an accent slab with a disc, a row of asterisks, an arrow, a huge numeral, and the shared library drawn at its heaviest settings. The huge numeral is at least a quarter of the canvas width tall: where the band, or the box a cut-in would give it, cannot hold one that large, another blunt graphic is drawn instead (a numeral picked by hand is drawn as picked; review bundle 4 S2). A band taller than the title takes its first graphic alone, with no cut-in, unless Advanced sets the cut-ins or picks the second (review bundle 4 S4; the share of designs with a cut-in stays about six in ten, 8.0).
- Layouts beyond the first: title set at 90 degrees up the edge, title cropped by the canvas edge (Advanced only, off by default), boxed variant with a full border, title split across top and bottom with the table between, one word per screen-filling line with the rest tiny, table-first with the title as the last row. Built at R8: title-top, title-bottom, table-first, split, boxed, title-up, screen, slab (a big band of graphic bleeding off both sides, the title under it). The cropped title was not built at R8 or R10 for want of a waiver of rule 1; the waiver is below.
- With marks on (7.2), a strip at the canvas's top and bottom edges (the sides on a quarter turn) is kept free for them; otherwise the page fills to its margins.
- **The cropped title: waiver of rule 1 (9.2), written 27 Nov 2026** (Carried R10 from R8 asked for it). In the layout `cropped`, and nowhere else, the title's lines may leave the canvas: every line may lose up to 12% of its width at one side, the same side for all, or the block may lose up to 15% of its height at the top or at the bottom; never both, and in 9:16 only the side crop, since the top and bottom belong to the story interface. At least 60% of every glyph's width stays on the canvas, so no letter is lost whole. Rule 1 holds for every other text item; rules 2 to 5 hold for the title as drawn. `cropped` stays Advanced only and off by default: Shuffle never rolls it, the Layout picker offers it, and `layout.crop` sets the side and the amount. Built at R26.
- Three more layouts (R26). `wall`: no band and no margin, the title's lines fill the page edge to edge and top to bottom at oversize, every other layer in one thin strip of mono between two rules. `repeat`: the title, or its first line where the title is long, set once at full width and repeated down the page to fill it; the repeats belong to the title item, as Vaporwave's echoes do (8.4), and are drawn in outline, in the accent or in alternating fills; the rules read the first. `cells`: a full-page exposed grid, every text layer in its own bordered cell, the title's cells the largest, empty cells filled with the accent or a blunt graphic.
- Line fills (R26, the type stream decides; Advanced `type.fill`): solid, as built; outline (alternate lines stroked, not filled, the stroke 0.04 to 0.08 of the line's height); split (a line cut level at a seeded height, its two parts in two colours, in register: an offset is photocopy's). One fill other than solid per design at most.

**Raw.** An unstyled document at poster size: default faces, visible structure, nothing arranged to please.
- Title in the pairing's `plain` face, bold where it has one, as typed (Advanced `type.case`: as typed, upper, lower), flush left, set solid (leading 0.82 to 0.95), oversize or normal. Not stretched and not scaled line by line: the lines are ragged. An underline, 0.06 em thick, on about one roll in three.
- Sizes clash: nothing between the title's size and text size. Every other layer in the mono or the plain face at text size.
- Info as a table with every cell bordered (2 to 6 px) and tight (0.4 em inside); the caption a line of mono under a rule.
- Ground and ink; the accent on two things at most (an underline or a cell, and one graphic).
- Layouts. `document`: one column from the top left in reading order, full-width rules between the parts, the foot of the page empty or holding one graphic. `frames`: the page tiled by bordered boxes of unequal size on a grid of 2 to 4 columns; each layer in a box; the other boxes empty, filled, or holding a graphic or a placeholder. `clash`: the title's longest word alone at the largest size the width takes, the rest of the title and every other layer at text size butted against it with no gap.
- Graphics: cells, placeholder, rules, lines, barcode, bars, blocks, arrow, asterisks, numeral, hazard, gradgrid (squares and crosses), shade (dither).
- No tilt. A quarter turn about one roll in six.

**Neo.** Neo-brutalism: outlined cards, hard shadows, clashing flat colour.
- Every block is a card: a flat fill, an ink outline (6 to 12 px at 1080, one weight per design, and a thinner second weight for small things), square corners, and a hard shadow: the card again in ink, offset down and to one side by 10 to 28 px, no blur. One shadow direction and one offset per design.
- Three accents with ink and ground, flat and clashing; one accent dominates (the largest card or the ground).
- Title in the display face, upper case, not stretched: set to its card's width on one to three lines.
- Subtitle on its own card. Info in a window (a title bar with three squares, outline, shadow) or a table card. Caption in a pill, the one rounded form the style allows, or a tag.
- Cards sit square on the grid and may overlap by up to a third; text is never covered (9.2 rule 3). No card is turned, the ground carries no pattern, and there is no serif italic: those are ice cream's (8.2). The whole composition may take the tilt about one roll in six.
- Layouts. `cards`: three to six cards of unequal size stacked and overlapping down the page, the title's the largest. `window`: one window frame over most of the page with the title inside; smaller windows and a burst overlap its corners. `billboard`: the title huge on a full-bleed accent ground, outlined, with a hard shadow of its own (an echo of the title in ink, offset as the cards are, and part of the title item); the other layers on cards at the foot.
- Graphics: burst, cells, placeholder, arrow, asterisks, disc, blocks, quarter, tri, squares, steps, gradgrid, shade (steps or halftone), hazard, barcode; each drawn as a card, outlined and shadowed.

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
- Built at R17 (with the review R17 fixes). The spec is `"v": 2` with `text` the layer list (ids `t1` to `t4` for a migrated v1 design, `pos` kept on each layer). The lead layer of each slot's level (the first headline, subhead, data and caption that is on and has words) is set by the style's own slot rules of 8.1 to 8.5 exactly as before, so a v1 design draws the same Scene (tested against Scenes recorded before R17). A further layer of a slot's level (a second headline, subhead, data or caption) is set alike: by the same type part's own setter, with only that slot on, in a room of the text area, so it takes the lead's face, case, fill treatment and size class, at 0.8 to 1.25 of the lead's size (Brutalist instead: every line at the full width, 8.3); Brutalist sets a second headline as a second full-width block, ice cream as strips or tiles (a second caption up the other edge), photocopy as collided words, Vaporwave in chrome, Swiss on the axis. Body and label, which have no slot rules, are set by one shared placer from the treatment the style's type part gives their level (face, case, start size, minimum, lines, alignment) on a plate of the style's plate colour (Swiss, Brutalist and ice cream: ground; photocopy: paper; Vaporwave: window), never above a higher level placed before them. Every layer keeps off every text item and plate, and in Vaporwave off the sun (8.4); a place is looked for clear of the graphics down to the minimum size, and goes over a graphic only where the style sets text there itself (a slot setter whose every text sits on its own plate, photocopy words with their paper halo, Vaporwave's knocked-out graphics; for body and label: Swiss full-bleed, ice cream, photocopy, Vaporwave), else the layer is flagged. Before the style lays out, room at the foot of the text area (at the foot of a turned page too) is kept for those layers, estimated from their words and level sizes only (never a face, so the type seed moves no graphic); candidates try more and less of it and none, the fallback none; with layers beyond the slots Brutalist's oversize title class is normal unless Advanced asks for it. Highest levels are placed first; where a layer is flagged while the lead of a lower level is drawn, the lower leads are set after it instead, and the solver keeps the candidate whose flags weigh least (one flagged layer of a level outweighs any number below it), so the lowest give way first. A layer that is on and is not drawn, or is drawn shortened, is listed in the Scene's `flagged` and its row on the Text tab is marked. Data layers keep up to three pairs. Text tab: one row per layer (level button, which steps through the six levels; field; More, which turns the row to its edit controls: in Advanced Move up and Move down, then on/off, Remove and Done; in Simple the level, on/off, Remove and Done); a layer that is off shows its words dimmed; then one Add row (a level button stepping through the six levels and one Add button, off at eight). In Advanced the slots' positions follow the lead layer's row, and every other layer's row has its place (Auto, Head, Foot) where its level has more than one place in the style (Swiss and Postmodern; Brutalist and Vaporwave have one).

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
- A parent with dialects gives its parts in one dialect: parent A's is `pick.dialect`, parent B's is `mix.dialect` (null: the layout stream decides).
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

1. No text item leaves the canvas or, in 9:16, enters the story zones. One waiver: the title in Brutalist's `cropped` layout, within the limits of 8.3.
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
- Finishes (R19), at strength 1 over 100 seeds per style, against Clean on the same design. Grain: the mean change in brightness is at least 9 levels of 255 over the seeds and at least 7 on every one. Grunge: at least 14; and in the middle 60% of the page (by width and by height) at least 6% of pixels change by more than 24 levels, and that share is at least half the share in the rest of the page. VHS: outside the held text, at least 1.8 times what the R7 build gives on the same seeds. Every finish: the guard puts back fewer than 5% of text items. The four thresholds were set on 27 Nov 2026 from R7's code (its Grain is noise of up to 16 levels, a mean of about 5), not from a measurement: the R19 builder measures the R7 build first, and where a figure here is under 1.5 times that measurement the figure is raised to 1.5 times and the change recorded.
- Dialects: every dialect of every style passes 9.2 alone, and 9.3 holds with the dialect left to the layout stream (the colour seed and the type seed move no box and change neither palette nor pairing when the dialect changes).
- Export: every size and file type gives a file of exactly the stated pixels (tested); the A3 print size completes in headless Chrome and its time and peak memory are recorded.

### 9.5 What the scripts cannot say

Whether it looks good. The reviewer looks at the sheets and lists seeds that are legal but clumsy (dead space, a cramped title, a graphic that fights the text). Pedro has the last word.

## 10. Screens

### 10.1 The frame

Same on every tab, both modes, nothing scrolls:

1. **Header:** the wordmark, set in lower case as `rstr` (Pedro, 26 Nov 2026; the browser tab title too), the seed as a chip (tap copies it), Kept, the Simple/Advanced switch.
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
| Style | The four styles as tiles, each tile a small live render, in the order Swiss, Brutalist, Postmodern, Vaporwave (27 Nov 2026) |
| Text | Slot or layer rows: name, field, on/off (from R17: add, remove, level) |
| Look | Light/Dark, Finish, Marks, Dialect where the style has one (Swiss, Brutalist, Postmodern), four reroll buttons: New layout, New colours, New graphic, New type, and a page of Elements family tiles (8.0, from R24); page chips if it does not fit one page |
| Photo (R14) | Add or change, Remove, Treatment tiles, New crop |

### 10.3 Advanced

Everything Simple has, plus the parameters. Seven tabs: Style, Layout, Graphic, Type, Colour, Text, Photo.

| Tab | Controls |
|---|---|
| Style | Style tiles, Finish with a strength dial, Marks with a picker of which marks are allowed, Light/Dark; second page: Mix (R18) |
| Layout | Layout picker (the style's layouts by name, those of the dialect drawn), transform (none, tilt, quarter turn), margin (Swiss, Brutalist), columns (Swiss), crop (Brutalist `cropped`), graphic share, title size class, axis column or tilt or horizon (whatever the style has) |
| Graphic | First and second graphic pickers, how the second is cut in, density, scale, line weight, angle, progression and module where the graphic has them, Elements (every graphic of the style, on or off), New graphic |
| Type | Pairing picker, title case (as typed, upper, lower: Swiss, and Brutalist's Raw dialect), title weight where the family has it (Swiss, R21), line fill (Brutalist Heavy), tracking, size cap |
| Colour | Palette picker; the design's three to five colours, each editable for this design only |
| Text | Each slot or layer: field, on/off, position, and from R17 level, add, remove, reorder |
| Photo | Role, scale, offset, treatment and its parameters (duotone roles, halftone screen, threshold level) |

- Every Advanced control writes a `pick` or a `params` value. A value set by hand survives Shuffle only if its facet is locked; otherwise Shuffle clears it.
- A style shows only the controls it has. Controls are generated from the parts' parameter lists, not written per style.
- Built at R10. Keys: `layout.transform`, `layout.size`, Swiss `layout.axis` and `layout.flag` (where the layout reads them), Swiss `layout.share` (the graphic's share in graphic-above and graphic-below, 0.6 to 1 of the style's own; Brutalist's band is set by its size class, 8.3), Vaporwave `layout.horizon` (with a horizon, 0.56 to 0.64 of the height), Postmodern's dialect; `pick.motif` (the first graphic), Vaporwave `vapor.first`, `vapor.second`, `vapor.extras`, `graphics.cut`, Swiss and Brutalist `graphics.second` and `graphics.cutShape` (the first cut-in's graphic and its shape; picking one cuts one in), and `g.<graphic>.<param>` for each graphic the design draws (a Tune stepper picks whose); `pick.pairing` by full name, `type.case` (Swiss), `type.track` (Swiss, the title's tracking, -0.06 to 0.04 em), `type.cap` (0.6 to 1, every style whose type reads the size cap: not Brutalist), the Paper edge (photocopy); `pick.palette` and `pick.colours`; `text.<slot>.pos` (Swiss, Postmodern); `finish.<name>.strength` and `marks.no.<kind>` (which marks are allowed); from R15 `photo.treatment` and the treatment's parameters `photo.duo` (the two roles), `photo.contrast` (mono), `photo.screen` and `photo.angle` (halftone), `photo.level` (threshold), `photo.levels` (posterise) and `photo.dot` (dither), each offered for the treatment drawn. Facets: `layout.*` and the positions are Layout's, `g.*`, `graphics.*`, `vapor.*`, `photo.treatment` and the `photo.*` treatment parameters Graphic's (the photo's role, scale and offset are Layout's), and a style change clears the treatment and its parameters, `type.*` and the Paper edge Type's, the colours Colour's. The finish strength and the marks allowed belong to no facet: Shuffle keeps them, as it keeps the finish and the marks (spec 3). A choice of up to four options is a row of segments with Auto first; a longer one is a stepper, which shows what the design draws while it is unset. A control is shown only on a design it changes: a part names the ones its design ignores, and the size class and size cap, whose effect hangs on how the text fits, are tried with the fonts in use. A transform a layout's rules refuse is not offered there. Open items of this table are in Carried (`docs/BACKLOG.md`).
- Settled 27 Nov 2026, from Carried R10 (from R10). **Margin:** Advanced may move the margin in Swiss and Brutalist, `layout.margin`, 0.5 to 1.5 of the style's own (36 to 108 px and 24 to 72 px at 1080), with its 9.2 test; Postmodern and Vaporwave have no single margin and get no control. **Title case:** the case belongs to the dialect. `type.case` is offered in Swiss (every dialect but Programme, which is lower case by rule) and in Brutalist's Raw dialect; Heavy and Neo are upper case by rule. Whether Postmodern and Vaporwave may be overridden stays open in Carried. **Title weight:** built at R21 for Swiss (6). New keys: `layout.margin`, `layout.cols` (Swiss: 4, 6, 8, 12), `layout.crop` (Brutalist `cropped`: side, amount), `type.fill` (Brutalist Heavy), `type.weight` (Swiss), `g.<graphic>.progression` and `g.<graphic>.module`. `pick.elements` and `pick.dialect` belong to no facet (3).

## 11. Later, outline only

Each needs a Fable chat to specify before it is built.

- **Motion:** a device test of MP4 export first (WebCodecs with an MP4 muxer; MediaRecorder as the fallback), then entrances and loops per style, 6 s default, 30 fps, silent. The motion vocabulary to start from is at the end of `docs/design/elements.md`.
- **The APK.**
- **More styles:** Bauhaus, Constructivist, Y2K. Not before the first four hold up.
