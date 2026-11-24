# Tuning pass, row R5 (Swiss)

What the tuning pass of R5 tightened and why. The run: `python3 tools/tune.py swiss 300` after a build. It makes 300 Swiss shuffles (seeds `shuffleSeeds(1000 + i)`, formats 1:1, 3:4, 9:16 in turn, light and dark in turn) in headless Chrome and lists the ones `clumsyOf` (`src/engine/proof.ts`) flags, each with its spec, plus `shots/tune-swiss.jpg` of the first 24. The rules find candidates only; whether a design is clumsy is a person's call (spec 9.5). Fonts: this workspace cannot reach Google Fonts, so pairings outside the bundled core set were drawn as the Swiss default; the counts below are for that run, not for every real pairing.

## The rules

As corrected in the fix row (review R5 S2); `clumsyOf` and `coverOf` in `src/engine/proof.ts`, tested on hand-built Scenes in `tests/tune.test.ts` (review R5 S5).

- `tiny title`: title under 6% of the canvas width (px) with three words or fewer.
- `empty`: more than 55% of the canvas (in 9:16, of the band between the story zones) is bare; 60% for type only, which is ground and type by definition. Covered is what text sits on (plus one grid cell round it) and what a graphic sits on, weighted by how much of its box the graphic reads as covering (`coverOf`, 0 to 1). A field or panel of colour is bare where nothing sits on it.
- `coverOf`: a plate (a cut-in, a reversed graphic) covers its box; disc, numeral and blocks cover their own drawn area, generously (disc 2 x its area, numeral 1.5 x its ink rect, blocks their filled cells plus disc); a field of marks covers four times its ink share (lines, bars, rings by weight and progression; waves by weight; rules by thickness over pitch and stagger; lattice by filled share plus line ink; dots by falloff; topo by levels and weight); crosshairs by their marks' squares. A rough estimate from parameters, not a pixel measurement.
- `small graphic`: the first graphic (the lead one where cut-ins are drawn behind it) covers under 10% of the canvas, weighted the same way.
- `fallback`: no candidate passed.

The build's version of `empty` (fields count as cover, every graphic box counts as full, type only exempt) is in rounds 5 to final of the first table; the corrected rule's counts are in the second.

## Rounds (build, the build's rule)

| Round | Flagged of 300 | By rule |
|---|---|---|
| 1 | 84 | empty 83, fallback 1 |
| 2 | 25 | empty 25 |
| 3 | 25 | empty 25 |
| 4 | 23 | empty 23 |
| 5 (rule changed, see below; loosened, review R5 S2) | 4 | empty 4 |
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

Round 4 to 5, a change to the rule, not to the designs: `empty` stopped counting the 9:16 story zones (sound: they are the app's) and started counting every non-plate rect over a tenth of the canvas as cover (not sound, review R5 S2: on centred-low and split the field is the whole page or half of it, so `empty` could never fire there, and graphic boxes counted as full whatever their ink). After that change 4 were flagged. The fix row reversed the second half; see "Fix row (review R5)" below.

Round 5 to 6:
- The shape beside a panel takes the free part of the graphic's full box, out to the canvas edge, not the part clipped to the tilted page: on a tilted page the plate floated.

By eye after round 6 (contact sheets and a 9:16 Cobalt and Pine sample; the counts did not move):
- In 9:16 a graphic whose box ends at the foot of the text area runs on into the bottom story zone, to a margin from the edge (review R1: dead ground under the 9:16 text and graphic). Small text in 9:16 is 12% larger.
- With info and caption both at the head, the title goes low: all four slots at the top left the foot bare.
- Crosshairs: in a box one module across the mark goes on the centre line, not the box edge; the ring stays whole inside the box.
- A column or band cut-in covers at most 60% of what shows of the first graphic: a full-width column hid a numeral.
- Disc radius minimum 0.2 to 0.3 of the short side.
- A shape (disc, numeral, crosshairs) is drawn in front of what is cut into it, and counted first (`lead`): a column cut-in hid a disc completely.

## Fix row (review R5)

Applied before the tightening: S1 (tilted pages give the title room in every layout, below), S3 (numeral kept inside its box), S6 (blocks and a disc cut-in), S7 (crosshairs never specks), M5 (blocks roll two-fill patterns). Then the corrected rule, `python3 tools/tune.py swiss 300` each round, the shot `shots/tune-swiss.jpg` looked at each round.

| Round | Flagged of 300 | By rule |
|---|---|---|
| A: corrected rule, after S1, S3, S6, S7, M5 | 106 | empty 102, small graphic 32 |
| B | 66 | empty 64, small graphic 18 |
| C | 52 | empty 50, small graphic 16 |
| D | 50 | empty 48, small graphic 16 |
| E | 35 | empty 34, small graphic 10 |
| F | 32 | empty 31, small graphic 10 |
| G | 28 | empty 27, small graphic 9 |
| H | 20 | empty 20, small graphic 2 |
| final (I) | 19 | empty 19, small graphic 2 |

Round A is not the build's designs: S1 and S7 had already moved them. With the build's rule the same designs would have counted lower; that was not measured.

S1, before round A (title on a tilted page within 25% of upright, now tested for every layout and format, 40 seeds each): full-bleed on a tilted or turned page takes the page's whole width for its panel and text and 0.62 of the height; centred-low drops its side indent on a tilted or turned page and its graphic takes 0.26 / 0.30 of the height when tilted; row split's text field 0.68 on a tilted or turned page; column split's text four and a half columns when tilted; column layout 1.5 columns when tilted; the vertical title strip two modules on a tilted or turned page; type only on a tilted or turned page uses part of the margin (0.6 of it).

A to B:
- Sparse graphics' lower ends raised: lines weight 0.04 to 0.2, waves 0.04 to 0.2, rings 0.05 to 0.2, bars 0.1 to 0.25, rules weight 0.002 to 0.008 and count 3 to 6, lattice weight 0.001 to 0.003 and filled 0 to 0.15, crosshairs size 0.15 to 0.3, numeral scale 0.55 to 0.8.
- Type only: the title starts at 1.75 times its class's start size and fits down until the width or the room binds (it stopped at its start size, about 62% of the width).

B to C:
- Graphic share of the text area upright 0.52 / 0.47 / 0.56 (9:16) to 0.58 / 0.54 / 0.60; centred-low 0.44 / 0.36 / 0.50 to 0.50 / 0.44 / 0.56.
- Column layout upright always three columns (was two in about half the rolls).
- Type only: no axis indent.
- Numeral weight max 0.32 to 0.22 (at the top the strokes merged into a blob).

C to D: type only's start size by class (small and normal differ again); a turned type only takes part of the side margins too (S1 test).

D to E:
- A quarter turn keeps the page's size, so its graphic keeps more room (0.40 / 0.44 of the text area, not the tilt's 0.30 / 0.36); column and centred-low give up room only when tilted.
- Numeral: a box much wider than one figure takes up to three figures in a row, much taller up to three in a column, counting on from the digit (one small figure was left in a wide band).

E to F:
- Column split takes four and a half text columns only when tilted (on a quarter turn it left a one-and-a-half column strip of graphic).
- A disc cut into blocks goes into the largest cell, where the blocks' own disc was (S6's first version, blocks disc 0, left that cell bare).

F to G:
- Blocks roll only two-fill patterns in any box, not only over a third of the page (M5's threshold missed small boxes; a split with one black cell was 79% bare); blocks disc min 0 to 0.15; crosshairs size min 0.3 to 0.45.

G to H:
- Row split: the graphic fills the ground's field edge to edge (an inset graphic left a frame of bare ground); text field 0.46 / 0.42 to 0.42 / 0.38.
- Disc radius min 0.3 to 0.4.

H to I: the vertical layout's graphic always bleeds off the top and side; the numeral's figure count threshold lowered (a tall column gets two figures).

By eye at the reviewer's named designs (`/tmp` script, not committed): the type-only palette seeds (3:4 light `{4242, 1, 5151, 6}`) now draw a title the full width and are not flagged; centred-low tilt 9:16 light `{1084, 2012, 3012, 4012}` not flagged; the numeral seed 1:1 dark `{770938808, ...}` draws "234" whole inside its box (cut only at the canvas edge); the 1:1 light crosshairs seed `{53186664, ...}` now draws seven ringed crosses, not specks, and is still flagged (66%); the centred-low tilt 9:16 dark `{202128586, ...}` disc and split tilt `{1090580831, ...}` are still flagged (59%, 62%); the S6 seeds draw no eclipse; S6's 3:4 light `{24938, ...}` is flagged at 58% and the 3:4 dark blocks + dots `{1377348019, ...}` at 66%.

## Left on the list

19 of 300 (all `empty`, two also `small graphic`). The rule finds candidates; whether each is clumsy is Pedro's call (spec 9.5). By eye in `shots/tune-swiss.jpg`, the vertical, quarter-turned centred-low and lone-disc designs still read sparse; they were not tightened further in this row. Also seen, not fixed (not flagged: the rule counts it covered): Yellow light, where accent and ink are both near-black, draws heavy waves as a solid black box (`shots/palettes-swiss.jpg`, fourth cell).

- swiss, 1:1, dark, seeds `{layout: 2624278800, colour: 2556459933, graphic: 2717739066, type: 2943003935}`: split, none, rules, cobalt, empty 62%
- swiss, 9:16, light, seeds `{layout: 715601025, colour: 517947694, graphic: 2773369716, type: 1958108659}`: split, none, blocks, pine, empty 57%
- swiss, 3:4, dark, seeds `{layout: 3138756405, colour: 1279197346, graphic: 3336170042, type: 2541274285}`: vertical, none, blocks+lines, yellow, empty 60%
- swiss, 3:4, light, seeds `{layout: 3022570574, colour: 3894770077, graphic: 2979662529, type: 2495892998}`: split, none, lattice, pine, empty 57%
- swiss, 9:16, light, seeds `{layout: 3340262059, colour: 1654490122, graphic: 2930248967, type: 1906908860}`: vertical, none, rules, paper, empty 55%
- swiss, 3:4, light, seeds `{layout: 3331449766, colour: 3821452624, graphic: 2298727245, type: 1040769376}`: vertical, none, topo, magenta, empty 60%
- swiss, 1:1, dark, seeds `{layout: 1578667597, colour: 191066234, graphic: 1209728698, type: 1982333830}`: centred-low, none, disc, signal, empty 68%
- swiss, 3:4, dark, seeds `{layout: 1232484712, colour: 696207225, graphic: 1212799098, type: 3010507921}`: split, quarter, numeral+disc, orange, empty 63%
- swiss, 3:4, light, seeds `{layout: 778417957, colour: 110516011, graphic: 2424332958, type: 729081416}`: centred-low, quarter, lattice, orange, empty 67%
- swiss, 1:1, dark, seeds `{layout: 2043670118, colour: 1091420861, graphic: 2416787839, type: 1483566569}`: centred-low, tilt, disc+waves, pine, empty 61%
- swiss, 9:16, dark, seeds `{layout: 1848535603, colour: 2519894057, graphic: 3881584559, type: 730314157}`: centred-low, quarter, crosshairs+topo, paper, empty 59%
- swiss, 9:16, dark, seeds `{layout: 3492369512, colour: 2796044437, graphic: 2080114770, type: 1474650205}`: column, none, rules, yellow, empty 64%
- swiss, 1:1, light, seeds `{layout: 1678521257, colour: 218392082, graphic: 1653548609, type: 4009363761}`: split, none, blocks, yellow, empty 57%
- swiss, 3:4, dark, seeds `{layout: 3427110106, colour: 393234734, graphic: 148125024, type: 2043863879}`: split, tilt, disc+topo, yellow, empty 62%
- swiss, 3:4, dark, seeds `{layout: 1377348019, colour: 2913652576, graphic: 2126723483, type: 2221845038}`: vertical, none, blocks+dots, yellow, empty 66%
- swiss, 1:1, light, seeds `{layout: 1744954846, colour: 3427226721, graphic: 2573838795, type: 1729984805}`: graphic-above, quarter, disc, magenta, empty 67%; small graphic 7%
- swiss, 9:16, light, seeds `{layout: 3842681294, colour: 2216721378, graphic: 378136737, type: 940630404}`: graphic-below, quarter, numeral+disc, orange, empty 57%
- swiss, 1:1, dark, seeds `{layout: 3521524761, colour: 4279357044, graphic: 3158833487, type: 1406730815}`: graphic-above, tilt, disc, orange, empty 62%
- swiss, 3:4, light, seeds `{layout: 1111635201, colour: 931184226, graphic: 769784909, type: 3711582940}`: column, tilt, crosshairs+waves+disc, pine, empty 63%; small graphic 8%
