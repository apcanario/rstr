# Swiss and Brutalist: what the two prime styles need

Research for the design chat of 27 Nov 2026 (Fable 5.2). Pedro: "we need a research on both of these styles to ascertain what we need for both to be even more complete, accurate but also modern." This file says what each movement is, what RSTR draws today, what is missing, and what the spec now asks for. The spec (`docs/SPEC.md` 8.0, 8.1, 8.3) is the rule; this file is the reason.

How to read the sourcing: a claim with a link was read on 27 Nov 2026 at that address. A claim marked *(general knowledge)* was not checked against a source in this chat and should be treated as the chat's own reading of the field. Nothing here quotes a poster's design as fact beyond what the linked page says.

## 1. Swiss

### 1.1 What it is

- A systematic approach to graphic design that took shape between the 1930s and 1950s and kept developing: asymmetric layouts, a grid, sans-serif type, text set flush left and ragged right. https://en.wikipedia.com/wiki/Swiss_Style
- The grid is mathematical and elements are anchored in it; sans serif replaced serif; illustration gave way to photography used as an objective element. https://courses.lumenlearning.com/suny-ecc-graphicdesign/chapter/1-6-international-typographic-style/
- The faces: neo-grotesques modelled on the nineteenth-century Akzidenz Grotesk (Univers, 1954, a family of 21 related fonts; Helvetica), preferred over the geometric sans serifs of the 1920s. https://de.slideshare.net/lovegraphix/international-typographic-style-40713064
- **Two schools, not one.** The Swiss National Library separates a Zurich School, which followed Concrete Art, put the weight on typography and tended to abstraction, from a Basel School grounded in New Objectivity; the International Style of 1950 to 1970 mixed the two: simple typography, rational composition without ornament, high impact, black-and-white photography in place of illustration. Armin Hofmann's Basel posters are described there as rigorously geometric, precise in type, often black and white. https://www.nb.admin.ch/en/the-zurich-concretists and https://www.nb.admin.ch/en/the-international-style-1950-1970
- **Zurich, Müller-Brockmann.** The Tonhalle concert posters (from 1950, the "Musica viva" series) grew more abstract and used scale, rhythm and repetition to stand for the structure of music. https://www.wikipedia.com/wiki/Josef_Muller-Brockmann The 1955 Beethoven poster is black and white: concentric arcs on an angular module of 11.25 degrees, arc lengths counted in modules (5, 6, 7 segments), arc widths doubling (1, 2, 4, 8, 16); in his own words the proportions of elements and gaps follow numerical progressions. https://www.behance.net/gallery/9862277/Mueller-Brockmanns-Beethoven-Poster The title on that poster is printed in lower case. https://collection.cooperhewitt.org/objects/2318803418
- **Layered colour.** Max Huber layered intense inks and kept busy compositions together with the grid. https://courses.lumenlearning.com/suny-graphicdesign/chapter/1-6-international-typographic-style/
- **Basel, Hofmann and Ruder.** Contrast as method (Ruder); black and white as Hofmann's usual range. https://www.modernism101.com/store/p/graphic-design-basel-school-of-arts-and-crafts-/-kunstgewerbeschule-basel-/-ecole-des-arts-et-mtiers-de-ble-basel-pharos-verlag-1967 and https://www.cooperhewitt.org/2018/08/05/aharmonyofcontrasts/
- **The programme, Gerstner.** *Designing Programmes* (1964): design as picking determining elements and combining them, a rule set that generates many solutions; the grid for the magazine Capital (1962 to 1963) has 58 units across so that it divides into one to six columns. https://openlab.citytech.cuny.edu/langecomd3504fa2019/files/2018/10/Gerstner_DesigningProgrammes.pdf and https://ms-studio.net/notes/karl-gerstners-layout-grid/ This is the closest historical relative of what RSTR is: rules and permutation, not drawing.
- **Now.** Swiss-style simplicity is still current in poster work, but looser and more playful than the canon (https://monocle.com/magazine/issues/139/in-the-frame); a 2026 trade article describes a return to precise, geometric work that leans on variable fonts and carries some brutalist influence (https://studio2am.co/blogs/news/the-precision-turn-why-minimalist-geometric-design-is-reasserting-itself-in-2026). The contemporary devices listed in 1.3 under "Now" (smooth colour blends inside geometric shapes, graded dot grids, mono labels, hairline frames, width contrast inside one variable family) are *(general knowledge)*: this chat found no single source that lists them.

### 1.2 What RSTR draws today (after R5)

One dialect: Müller-Brockmann's, on a fixed grid of 6 columns with one margin. 8 layouts, 12 graphics (topo, blocks, bars, dots, disc, lines, rules, numeral, crosshairs, lattice, rings, waves), 8 palettes, 16 pairings, flat colour only, one topo look.

### 1.3 What is missing, and what the spec now asks for

| Gap | Why it matters | Now in the spec |
|---|---|---|
| Only the Zurich manner | The canon has at least a second school (Basel) and a method (the programme); a modern Swiss poster is a fourth thing | Four dialects: Zurich, Basel, Programme, Now (8.1) |
| Graphics are placed, not constructed | The Zurich posters are built on modules and progressions | The progression rule (8.0); constructed graphics: arcs, rays, quarter tiles, steps, squares (8.0, R22); four constructive layouts (8.1) |
| One grid | Real grids vary with the job; Gerstner's divides six ways | 4, 6, 8 or 12 columns per design; margin as a control (8.1, 10.3) |
| Flat colour only | Overprinted inks are canon (Huber); graded screens are how a letterpress or litho poster shades; smooth blends are today's | Overprint graphic; graded grids; shaped gradients in steps, halftone or line screen everywhere, smooth blends in Now only (8.0, 8.1) |
| One topo look | Pedro's ask: more topographical variety | Topo renders, landforms and crops, plus ridges, flow, relief and sections (8.0, R23) |
| Type range | 16 pairings, most of them a single family at one width | 32 pairings; width contrast inside one family (Archivo, Mona Sans, Hubot Sans); a mono for labels (6, `pairings.md`) |
| Lower-case titles | The Tonhalle posters set titles in lower case | Zurich rolls all lower case about one time in five; Programme always (8.1) |
| No way to restrict the graphics | Pedro, 25 Nov 2026: choose only lines, only dots, only topography, then shuffle inside that | The Elements filter (8.0, 10.2) |

Kept out on purpose: figurative illustration (spec 2), licensed faces (Helvetica, Univers, Akzidenz are never shipped; the free stand-ins are in `pairings.md`), centred layouts, decorative serifs as display.

## 2. Brutalist

### 2.1 What it is

- The name comes from architecture: *béton brut*, raw concrete; "New Brutalism" was Reyner Banham's term in 1955. In graphic and web design the label arrived late: Bloomberg Businessweek's redesign under Richard Turley about 2013, and Pascal Deville's BrutalistWebsites.com in 2014. Punk zines of the late 1970s and 1980s worked the same way without the name. https://www.designyourway.net/blog/brutalist-graphic-design/
- The traits that page lists: oversized heavy type as the main visual element, clashing sizes and weights, leading very tight or very loose; black and white or one colour, sometimes one loud accent; a grid that is either broken or exposed as visible borders, outlines and column lines; asymmetry; structure shown, not hidden; **no gradients, no drop shadows, no rounded corners**; system and default fonts (Courier, Arial, Times New Roman, Verdana) and monospace. Same source.
- **Neo-brutalism** (also "neubrutalism"), the form current in interfaces and now in print: thick high-contrast outlines of uneven weight; hard black shadows with no blur, often a second rectangle offset under a button; clashing colour pairs held under about 80% saturation, one dominant colour, pure black and white for contrast; plain geometric shapes that recall early-web windows; huge bold type in simple faces with generous white space. https://www.svgator.com/blog/what-is-neubrutalism/
- It is an attitude more than one look, and David Carson's nineties work is often named as a forerunner (https://madegooddesigns.com/brutalist-graphic-design/); in RSTR that ground belongs to Postmodern's photocopy dialect, so Brutalist stays clean-edged and leaves the dirt to the finishes.

### 2.2 What RSTR draws today (after R8)

One dialect: stretched heavy type filling the width, a band of blunt graphics, a table, two colours and an accent. 8 layouts, 12 graphics, 8 palettes, 10 pairings. The cropped title of spec 8.3 was never built (no waiver of rule 1).

### 2.3 What is missing, and what the spec now asks for

| Gap | Why it matters | Now in the spec |
|---|---|---|
| Only the poster manner | The raw-document look (default fonts, visible tables and borders) is the core of the web movement; neo-brutalism is the modern form | Three dialects: Heavy, Raw, Neo (8.3) |
| No exposed grid | Visible borders, outlines and column lines are a listed trait | The cells graphic, the `cells` and `frames` layouts (8.3) |
| No cropped or repeated type | Type as mass, cut by the edge or repeated, is the idiom | The cropped title with its waiver of rule 1; the `repeat` and `wall` layouts; outline and split fills (8.3) |
| Default faces absent | Courier, Arial and Times are the movement's faces; none is free | Their free metric stand-ins on Google Fonts: Cousine, Arimo, Tinos, as the `plain` face of a pairing (6, `pairings.md`) |
| 10 display faces | "HEEEEEEAVY TYPE" needs range: ultra-condensed, ultra-wide, slab, stencil, mono, a width axis | 31 pairings (6, `pairings.md`) |
| Gradients | Pedro asked for geometric gradients; the style rejects smooth ones | Graded grids and shaped gradients only as hard steps, halftone, line screen or dither; never a smooth blend, never a blur (8.3) |
| Blunt graphics are few | 12, half of them the shared library at heavy settings | 24: adds hazard stripes, cells, placeholder, burst and the constructed geometry of R22 at its heaviest (8.3) |

Kept out on purpose: texture and distress inside the style (that is Grunge, a finish, or the photocopy dialect), rounded corners outside Neo's pills, smooth gradients, soft shadows, any tilt of single cards in Neo (that is ice cream's manner).

## 3. Fonts checked

Every family added on 27 Nov 2026 was checked the same day against the metadata of its `@fontsource/<id>` npm package: `type` is `google` (the family is served by Google Fonts), the licence is OFL-1.1 (Ultra: Apache-2.0), and the weights and axes used in `pairings.md` exist. The npm registry is reachable from the build workspace where Google Fonts is not, which is what row R21 uses to get real font files into the tests.

| Family | Weights or axes found |
|---|---|
| Chivo, Chivo Mono | 100 to 900 |
| Host Grotesk | 300 to 800 |
| Public Sans, Albert Sans, Onest, Be Vietnam Pro, Barlow, Barlow Condensed, Sofia Sans, Sofia Sans Extra Condensed, Saira Extra Condensed, Lexend Zetta, Doto | 100 to 900 |
| Golos Text | 400 to 900 |
| Radio Canada Big | 400 to 700 |
| Rethink Sans | 400 to 800 |
| Reddit Sans, Reddit Mono, Unbounded | 200 to 900 |
| Mona Sans, Hubot Sans | 200 to 900, width 75 to 125 |
| Archivo | 100 to 900, width 62 to 125 |
| Anybody | 100 to 900, width 50 to 150 |
| Martian Mono | 100 to 800, width 75 to 112.5 |
| Arimo | 400 to 700 |
| Tinos, Cousine, Space Mono, Courier Prime, Stardos Stencil | 400, 700 |
| Antonio | 100 to 700 |
| Big Shoulders Stencil | 100 to 900 (the package `big-shoulders-display` also still resolves; Carried R3 item 2) |
| Climate Crisis, Rubik Mono One, Six Caps, Fjalla One, Saira Stencil One, Ultra, Abril Fatface | 400 only |
| JetBrains Mono | 100 to 800 |
| IBM Plex Mono | 100 to 700 |
| Geist Mono | 100 to 900 |
| DM Mono | 300 to 500 |

Not checked: how each face looks in a title; the vertical metrics the Brutalist stretch depends on. R21 measures both.
