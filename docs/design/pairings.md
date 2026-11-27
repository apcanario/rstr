# Font pairings

The starting list for row R3, extended on 27 Nov 2026 for row R21 (Swiss 16 to 32, Brutalist 10 to 32; 80 pairings in all). Every family here is meant to be on Google Fonts (free to use). The R3 builder checks each one resolves from Google Fonts, drops or swaps any that does not, and records the change. Weights are the ones the styles use; load nothing else.

Sources: Pedro's own picks (23 Nov 2026), Typewolf's "Five Fresh Headline & Body Text Pairings on Google Fonts" (https://www.typewolf.com/blog/google-fonts-combinations), the spike, and this plan's own additions. The Muzli article Pedro linked (https://medium.muz.li/15-google-font-pairings-every-designer-should-save-6468e3534a0e) could not be opened on 23 Nov 2026; add from it when someone can read it.

A pairing is display / text / mono. "Same" means one family does the job.

## Swiss

Single grotesque families first: that is the idiom. Serif contrasts last.

| Id | Display | Text | Mono or labels | From |
|---|---|---|---|---|
| sw-inter-tight | Inter Tight 800 | Inter Tight 400, 500 | same | Spike, approved look. Default |
| sw-inter | Inter 800 | Inter 400 | same | Pedro |
| sw-dm-sans | DM Sans 800 | DM Sans 400 | same | Pedro |
| sw-archivo | Archivo 800 | Archivo 400 | same | Pedro |
| sw-archivo-narrow | Archivo Narrow 700 | Archivo 400 | same | Pedro |
| sw-instrument | Instrument Sans 700 | Instrument Sans 400 | same | Plan |
| sw-geist | Geist 800 | Geist 400 | Geist Mono 400 | Plan |
| sw-hanken | Hanken Grotesk 800 | Hanken Grotesk 400 | same | Plan |
| sw-schibsted | Schibsted Grotesk 800 | Schibsted Grotesk 400 | same | Plan |
| sw-work | Work Sans 800 | Work Sans 400 | same | Plan |
| sw-plex | IBM Plex Sans 700 | IBM Plex Sans 400 | IBM Plex Mono 400 | Plan |
| sw-space | Space Grotesk 700 | Space Grotesk 400 | Space Mono 400 | Plan |
| sw-inter-alegreya | Inter 800 | Alegreya 400, 400 italic (subtitle) | Inter 500 | Pedro |
| sw-franklin-baskerville | Libre Franklin 800 | Libre Baskerville 400, 400 italic | Libre Franklin 500 | Typewolf |
| sw-work-taviraj | Work Sans 700 | Taviraj 400, 400 italic | Work Sans 500 | Typewolf |
| sw-archivo-instrument | Archivo 800 | Instrument Serif 400, 400 italic | Archivo 500 | Plan |

In a serif contrast the serif sets the subtitle only; title, info and caption stay in the grotesque.

### Added 27 Nov 2026 (row R21)

Swiss goes from 16 to 32 pairings. A Swiss pairing now has up to five roles, so that one pairing serves every dialect of spec 8.1 and the type seed never depends on the dialect (spec 6): **display**, **text**, **labels** (a mono, or "same"), **narrow** and **wide** (optional: a second width of the same design, for the width contrast of the Now dialect; where a pairing has none, Now contrasts weights instead), and **serif** (optional, the subtitle of a serif contrast, as before).

Roles the 16 pairings above did not have: labels is the mono already listed where there is one; `sw-inter-tight` takes DM Mono 400 (core, so the default pairing still needs no fetch); the rest use their grotesque at 500, tracked. `sw-archivo` takes narrow Archivo 800 at width 62 and wide at width 125.

Every family below was checked on 27 Nov 2026 against its `@fontsource` package metadata (type `google`, weights and axes as used): `swiss-brutalist.md` section 3.

| Id | Display | Text | Labels | Narrow / wide | Note |
|---|---|---|---|---|---|
| sw-chivo | Chivo 900 | Chivo 400 | Chivo Mono 400 | | A grotesque with a real black weight |
| sw-host | Host Grotesk 800 | Host Grotesk 400 | same | | |
| sw-public | Public Sans 800 | Public Sans 400 | same | | Franklin model |
| sw-albert | Albert Sans 800 | Albert Sans 400 | same | | |
| sw-onest | Onest 800 | Onest 400 | same | | |
| sw-golos | Golos Text 800 | Golos Text 400 | same | | |
| sw-radio-canada | Radio Canada Big 700 | Radio Canada Big 400 | same | | 700 is its heaviest |
| sw-be-vietnam | Be Vietnam Pro 800 | Be Vietnam Pro 400 | same | | |
| sw-rethink | Rethink Sans 800 | Rethink Sans 400 | same | | |
| sw-reddit | Reddit Sans 800 | Reddit Sans 400 | Reddit Mono 400 | | |
| sw-barlow | Barlow 800 | Barlow 400 | same | Barlow Condensed 700 | Two widths as two families |
| sw-sofia | Sofia Sans 800 | Sofia Sans 400 | same | Sofia Sans Extra Condensed 800 | |
| sw-mona | Mona Sans 800 | Mona Sans 400 | same | Mona Sans 800 at width 75 / at width 125 | One family, a width axis: the Univers idea with a free face |
| sw-hubot | Hubot Sans 800 | Hubot Sans 400 | same | Hubot Sans 800 at width 75 / at width 125 | |
| sw-archivo-widths | Archivo 800 | Archivo 400 | same | Archivo 800 at width 62 / at width 125 | |
| sw-arimo | Arimo 700 | Arimo 400 | Cousine 400 | | The free metric stand-in for Arial: the nearest thing to the default grotesque |

## Postmodern

Heavy display, an italic serif for the subtitle, a mono for info and caption. Heavy: the third face of the photocopy dialect's title words (spec 8.2: display, serif and heavy), a bundled core face so it is always there (R6).

| Id | Display | Subtitle | Mono | Heavy | From |
|---|---|---|---|---|---|
| pm-bricolage | Bricolage Grotesque 800 | Instrument Serif italic | DM Mono 400 | Anton 400 | Spike, approved look. Default |
| pm-rubik-trirong | Rubik 800 | Trirong 400 italic | Space Mono 400 | Archivo Black 400 | Typewolf |
| pm-syne-fraunces | Syne 800 | Fraunces 400 italic | DM Mono 400 | Anton 400 | Plan |
| pm-unbounded-young | Unbounded 700 | Young Serif 400 | JetBrains Mono 400 | Archivo Black 400 | Plan |
| pm-familjen-gloock | Familjen Grotesk 700 | Gloock 400 | IBM Plex Mono 400 | Anton 400 | Plan |
| pm-eczar-gentium | Eczar 800 | Gentium Book Plus 400 italic | Courier Prime 400 | Archivo Black 400 | Typewolf (two serifs; their Gentium Basic is now Gentium Book Plus) |
| pm-darker-playfair | Darker Grotesque 900 | Playfair Display 400 italic | Space Mono 400 | Anton 400 | Plan |
| pm-rubikmono-cormorant | Rubik Mono One 400 | Cormorant Garamond 500 italic | DM Mono 400 | Archivo Black 400 | Plan |

## Brutalist

Heavy only. The display face carries the poster; everything else is mono.

| Id | Display | Mono | From |
|---|---|---|---|
| br-anton | Anton 400 | DM Mono 400 | Spike, shown |
| br-archivo-black | Archivo Black 400 | DM Mono 400 | Spike, shown |
| br-bebas | Bebas Neue 400 | IBM Plex Mono 400 | Plan |
| br-big-shoulders | Big Shoulders Display 900 | JetBrains Mono 400 | Plan |
| br-league | League Gothic 400 | Space Mono 400 | Plan |
| br-oswald | Oswald 700 | IBM Plex Mono 400 | Plan |
| br-alfa | Alfa Slab One 400 | Courier Prime 400 | Plan |
| br-dela | Dela Gothic One 400 | Space Mono 400 | Plan |
| br-bowlby | Bowlby One 400 | Courier Prime 400 | Plan |
| br-archivo-wide | Archivo 900 at width 125 | Archivo Narrow 500 (in place of mono) | Pedro's Archivo + Archivo Narrow, pushed to the extremes |

### Added 27 Nov 2026 (row R21)

Brutalist goes from 10 to 32 pairings. A Brutalist pairing now has three roles, so that one pairing serves every dialect of spec 8.3: **display** (Heavy and Neo titles), **mono**, and **plain** (the Raw dialect's face: a default-looking serif, sans or mono). Tinos, Arimo and Cousine are the free metric stand-ins for Times New Roman, Arial and Courier New.

Plain for the 10 pairings above: `br-anton` DM Mono 400, 500 (core, so the default pairing still needs no fetch); `br-archivo-black` Instrument Serif 400 (core); `br-bebas`, `br-league`, `br-alfa` Tinos 400, 700; `br-big-shoulders`, `br-oswald`, `br-archivo-wide` Arimo 400, 700; `br-dela`, `br-bowlby` Cousine 400, 700.

| Id | Display | Mono | Plain | Note |
|---|---|---|---|---|
| br-anybody | Anybody 900, width 50 to 150 | JetBrains Mono 400 | Arimo 400, 700 | A width axis: lines can be set narrow or wide before the stretch |
| br-climate | Climate Crisis 400 | Space Mono 400 | Tinos 400, 700 | Very heavy |
| br-rubik-mono | Rubik Mono One 400 | DM Mono 400 | Cousine 400, 700 | |
| br-sofia-xc | Sofia Sans Extra Condensed 900 | IBM Plex Mono 400 | Tinos 400, 700 | |
| br-saira-xc | Saira Extra Condensed 900 | Space Mono 400 | Arimo 400, 700 | |
| br-barlow-c | Barlow Condensed 900 | Courier Prime 400 | Tinos 400, 700 | |
| br-antonio | Antonio 700 | DM Mono 400 | Cousine 400, 700 | |
| br-six | Six Caps 400 | Cousine 400 | Tinos 400, 700 | Ultra-condensed |
| br-fjalla | Fjalla One 400 | IBM Plex Mono 400 | Arimo 400, 700 | |
| br-chivo | Chivo 900 | Chivo Mono 400 | Tinos 400, 700 | |
| br-lexend | Lexend Zetta 900 | Martian Mono 400 | Arimo 400, 700 | Ultra-wide |
| br-unbounded | Unbounded 900 | DM Mono 400 | DM Mono 400, 500 | Core fonts only |
| br-stencil | Big Shoulders Stencil 900 | JetBrains Mono 400 | Cousine 400, 700 | Stencil |
| br-saira-stencil | Saira Stencil One 400 | Space Mono 400 | Arimo 400, 700 | Stencil |
| br-stardos | Stardos Stencil 700 | Courier Prime 400 | Tinos 400, 700 | Stencil serif |
| br-ultra | Ultra 400 | Courier Prime 400 | Tinos 400, 700 | Heavy slab (Apache-2.0) |
| br-abril | Abril Fatface 400 | DM Mono 400 | Tinos 400, 700 | Heavy didone |
| br-martian | Martian Mono 800 | Martian Mono 400 | Cousine 400, 700 | A mono as the display |
| br-space-mono | Space Mono 700 | Space Mono 400 | Cousine 400, 700 | A mono as the display |
| br-tinos | Tinos 700 | Cousine 400 | Tinos 400, 700 | The default serif, stretched |
| br-arimo | Arimo 700 | Cousine 400 | Arimo 400, 700 | The default sans, stretched |
| br-doto | Doto 900 | DM Mono 400 | Cousine 400, 700 | Dot matrix |

R21 measures every display face in the Heavy title (spec 8.3: every line at full width inside the 0.55 to 1.9 stretch, in every format) with its real font files. A face that cannot do it is dropped from this table with a changelog line; it is not kept with a fallback.

## Vaporwave

A wide or retro display, a clean tracked sans for the subtitle, a pixel face for the window.

| Id | Display | Subtitle | Pixel | From |
|---|---|---|---|---|
| vp-unbounded | Unbounded 800 | Inter Tight 500 | Silkscreen 400 | Spike, shown |
| vp-krona | Krona One 400 | Space Grotesk 500 | VT323 400 | Plan |
| vp-audiowide | Audiowide 400 | Michroma 400 | Pixelify Sans 500 | Plan |
| vp-syncopate | Syncopate 700 | Syncopate 400 | Press Start 2P 400 | Plan |
| vp-orbitron | Orbitron 900 | Space Mono 400 | VT323 400 | Plan |
| vp-monoton | Monoton 400 | Michroma 400 | Silkscreen 400 | Plan |
| vp-playfair | Playfair Display 900 italic | Cormorant Garamond 500 | DotGothic16 400 | Plan (the serif vapor look) |
| vp-cormorant-proza | Cormorant Garamond 700 italic | Proza Libre 400 | VT323 400 | Typewolf |
