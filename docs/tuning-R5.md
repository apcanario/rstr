# Tuning pass, row R5 (Swiss)

What the tuning pass of R5 tightened and why. The run: `python3 tools/tune.py swiss 300` after a build. It makes 300 Swiss shuffles (seeds `shuffleSeeds(1000 + i)`, formats 1:1, 3:4, 9:16 in turn, light and dark in turn) in headless Chrome and lists the ones `clumsyOf` (`src/engine/proof.ts`) flags, each with its spec, plus `shots/tune-swiss.jpg` of the first 24. The rules find candidates only; whether a design is clumsy is a person's call (spec 9.5). Fonts: this workspace cannot reach Google Fonts, so pairings outside the bundled core set were drawn as the Swiss default; the counts below are for that run, not for every real pairing.

## The rules

- `tiny title`: title under 6% of the canvas width (px) with three words or fewer.
- `empty`: more than 55% of the canvas (in 9:16, of the band between the story zones) is bare ground, with no text (plus one grid cell round it), graphic box or field of colour over it. Type only is exempt.
- `small graphic`: the first graphic (the lead one where cut-ins are drawn behind it) shows on under 10% of the canvas.
- `fallback`: no candidate passed.

## Rounds

| Round | Flagged of 300 | By rule |
|---|---|---|
| 1 | 84 | empty 83, fallback 1 |
| 2 | 25 | empty 25 |
| 3 | 25 | empty 25 |
| 4 | 23 | empty 23 |
| 5 (rule corrected, see below) | 4 | empty 4 |
| 6 | 2 | empty 2 |
| final, after the by-eye fixes | 2 | empty 2 |

## What was tightened

Before the tool (from the sheets, by eye, and from failing tests):
- Small title class: start size 0.55 to 0.65 of normal. At 0.55 a 9:16 split left a tiny title and half the page bare.
- No `small` title on a tilted or turned page (review R13 item 2); type only always takes `oversize` (it is carried by the title alone).
- The transform is drawn from the layout stream once, not per candidate: a per-candidate transform let the type seed move graphics (9.3 failed on the stub).
- On a tilted or turned page the graphic gives up room (share of the text area 0.36, square 0.30, instead of 0.52 / 0.47) and the axis is at most column 1, so the title stays within 25% of its upright size (tested). Graphics pay for the tilt (spec 8.1).
- Centred-low at 1:1: graphic share 0.44 to 0.36. Two 1:1 specs with the 8-word title and the layout picked fell back in smoke.
- A cut-in's plate is never the colour the first graphic sits on: a plate of that colour only erased part of a sparse graphic (a crosshair ring cut flat).
- Crosshairs arm length minimum 0.06 to 0.15 of the short side: at the low end the marks were specks.

Round 1 to 2:
- On a tilted or turned page an inset graphic box bleeds instead (graphic above, below, vertical, centred-low): inset boxes floated as a small tilted card in a field of ground.
- Column layout takes two columns, not three, on a turned page.
- Vertical title layout: graphic share 0.46 to 0.62.
- The `empty` rule exempts type only (it is ground and type by definition).

Round 2 to 4:
- A shape graphic (disc, numeral, blocks, crosshairs) beside a full-bleed panel sits on an accent plate: on bare ground a small shape left the page empty.
- Vertical title layout: graphic share 0.62 to 0.70 (0.64 at 1:1).

Round 4 to 5, a correction to the rule, not to the designs: `empty` counted the 9:16 story zones and full fields of colour as bare ground. The approved refs (`swiss-blocks-9x16`, `v2-swiss-53`) have ground in the story zones and a full accent field, so counting them was wrong. After the correction 4 were flagged.

Round 5 to 6:
- The shape beside a panel takes the free part of the graphic's full box, out to the canvas edge, not the part clipped to the tilted page: on a tilted page the plate floated.

By eye after round 6 (contact sheets and a 9:16 Cobalt and Pine sample; the counts did not move):
- In 9:16 a graphic whose box ends at the foot of the text area runs on into the bottom story zone, to a margin from the edge (review R1: dead ground under the 9:16 text and graphic). Small text in 9:16 is 12% larger.
- With info and caption both at the head, the title goes low: all four slots at the top left the foot bare.
- Crosshairs: in a box one module across the mark goes on the centre line, not the box edge; the ring stays whole inside the box.
- A column or band cut-in covers at most 60% of what shows of the first graphic: a full-width column hid a numeral.
- Disc radius minimum 0.2 to 0.3 of the short side.
- A shape (disc, numeral, crosshairs) is drawn in front of what is cut into it, and counted first (`lead`): a column cut-in hid a disc completely.

## Left on the list

Two, both vertical title, blocks first, 3:4 dark Yellow, `empty 55%`:
- swiss, 3:4, dark, seeds `{layout: 3138756405, colour: 1279197346, graphic: 3336170042, type: 2541274285}` (blocks + lines);
- swiss, 3:4, dark, seeds `{layout: 1377348019, colour: 2913652576, graphic: 2126723483, type: 2221845038}` (blocks + dots).

The blocks pattern there leaves one or two cells as ground, so the upper right reads half empty. Left as they are: the blocks fills are the approved look's own (`FILLS`), and they sit at the threshold. Pedro to look.
