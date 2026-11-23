# Marks and effects

Visual elements carried over from Pedro's earlier render engine (`apcanario/shomen-engine`, `specs/hud-spec.md` section 4 and 8.4, `specs/hud-v2-deltas.md`). Only the elements are reused. No Shōmen name, logo, colours, athlete content or wording comes with them. Sizes are at 1080 wide and are the starting values.

## Marks: small technical graphics

| Mark | What it is |
|---|---|
| Fine grid | 54 px squares, 1 px lines at 4 to 5% of ink |
| Slashes | Parallelograms at 60 degrees from horizontal, in a corner, running in from the edge: one big (64 wide), one medium (44, partly off-canvas), a thin companion (5) in the second accent, a hairline (1.5) |
| Mini slashes | Two 16 x 30 slashes in the two accents, at the start of a footer line |
| L-brackets | Two-stroke corners, 3 px, 32 long, around a text block or the graphic's box, in two accents on opposite corners |
| Tick ruler | 1 px ticks every 7 to 10 px, every fifth one longer; horizontal under a label or vertical along a free edge |
| Crosshair | r 24 circle, four arms from 12 to 36, r 4 accent dot, two mono readouts beside it |
| Arc gauge | An arc around the crosshair with 12 ticks, an outer ring and a second-accent segment |
| Chamfered card | A panel with a 45 degree chamfer of about 28 px on two opposite corners, 1 px border, a 6 px accent bar on the left split in two colours. A home for the info slot |
| Chamfered chip | Small outlined container with 14 px chamfers and a micro label above |
| Highlight bar | 72 to 84 tall, 1 px outline, 10% fill, a solid angled tab on the left with a label, value right-aligned |
| Underline bar | 4 px, 360 to 430 long, under the title, with a micro label beside it on the free side |
| Status cells | A row of segmented cells, some filled, with a short readout |
| Barcode strip | Bars of varied width with an id under it |
| Dot matrix | A small block of dots, some lit |
| Vertical word | A word turned 90 degrees on a free edge strip with a 4 px rule beside it |
| Scrim band | A translucent band behind a word that sits over a busy graphic |
| Footer line | Hairline at 20%, a tracked line of small text, optional ruler |

**Micro labels** carry only what the spec knows: the seed, the format, the style and palette names, the date of export, a counter (`01 / 01`), the app name. Nothing invented that could be read as a fact (no fake coordinates, places or reference codes).

Marks never sit on a text item and never enter a text item's box except the ones built to hold text (card, chip, highlight bar, underline bar, scrim band).

## Effects, as finishes

All off by default. Two-pass rule: graphics are drawn, the effect is applied, then every text item is drawn on top. An effect never displaces, splits or scan-lines text.

| Effect | Recipe |
|---|---|
| Slice displacement + RGB split | Horizontal bands 3 to 50 px tall shifted 10 to 90 px, red and blue channels rolled 3 to 10 px; about 18 seeded bands on a still |
| Chroma bleed | Red +2 px, blue -2 px, constant |
| Scanlines | Every other row at 0.90 |
| Streak grain | Gaussian noise blurred 11 x 1 horizontally |
| Tracking band | A 46 px band of jittered rows with 10% white noise |
| Head-switching noise | The bottom 36 px skewed progressively, with noise |
| Corruption bars | About 16 short solid ticks, 2 to 8 px tall, 30 to 220 long, in the accents at 35 to 85%, in empty areas |
| Pixel-sort smear | One fading smear 20 px tall, 180 long, off the edge of a graphic |
| Character rain | Falling columns of `0-9 A-F < > / + = : * #` in a mono face, bright head and accent trail, behind everything; motion only |

When an effect is on, any text set in a light weight steps up one weight.

## Motion, for phase 2

Scan reveal (a line sweeps down, content appears behind it), per-glyph cascade on the title, light sweep across the title, a flash and a 0.3 s micro-shake when the title lands, status cells filling one by one, gauge sweep, card wipe; ambient: slow zoom, glow pulse, slash drift, crosshair on a Lissajous path, ruler scroll, digit jitter, a scan line every 5 s.
