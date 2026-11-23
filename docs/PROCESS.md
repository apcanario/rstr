# Process log

How RSTR was made, chat by chat: who asked for what, which model did what, what was checked, what went wrong, what a person changed. Kept so the development process can be analysed afterwards. `docs/CHANGELOG.md` records what changed in the app per row; this file records how each chat went. `docs/reviews/` keeps every review report.

## Rules

- **One entry per chat**, newest first, written by the chat itself before its last push. A chat that stops early still writes its entry.
- **Record what happened, not what was planned.** The model that actually ran, the agents actually launched, the checks actually run and their real results.
- **Never estimate.** A number the chat cannot see (tokens, cost, wall time, memory) is written as "not visible", never guessed.
- **Pedro's words go in verbatim** where he gave an instruction, a note or a verdict: the starter's `Notes:` line in full, and any message during the chat. Paraphrase is marked as paraphrase.
- **Failures stay in.** A rebuild verdict, a flaky script, a wrong turn, a finding that was rejected: each is a line. Nothing is tidied out afterwards. An entry is corrected by adding a dated correction under it, not by rewriting it.
- Entries are facts in short lines. No assessment of how well it went; that is for whoever analyses the log.

## Entry format

```
### <date> · <bundle or "Design"> · chat <n of this bundle>
- Started from: <the starter as sent, with the Notes line verbatim, or Pedro's request verbatim>
- Main chat model: <as it actually ran>
- Rows: <attempted> / <closed> / <left open and why>
- Agents: <role, model, row> one per line, in order, with the verdict or six-line reply summarised in a phrase
- Reviews: per row <verdict; errors / should-fix / minor; applied / rejected with reason; rebuilds>
- Scripts: check <pass/fail, test count>, smoke <pass/fail, anything flaky and how often>, sheet <ran / not>
- Choices taken without asking: <one per line>
- Human input during the chat: <verbatim, with time if known; or "none">
- Stopped: <finished the bundle | out of room after row X | blocked: why>
- Commits: <first..last short hashes on main>
- Usage: <tokens / time if the session shows them; otherwise "not visible">
- Carried out of this chat: <ids added to Carried>
```

## Entries

### 23 Nov 2026 · Design · chat 1 (Fable 5.2, one long chat, 18:40 to 20:54 Lisbon time)

- Started from (paraphrase of a dictated request): Pedro attached an export of his Shōmen content engine (a Python render pipeline run from chats) and asked whether a groovebox-style phone app could generate images and video inside customisable, randomised rule sets ("kind of like a modular identity system"), starting small with Swiss, Müller-Brockmann-like designs, with toggled text boxes and square, 3:4 and story sizes; he asked for a feasibility assessment, a plan and mock-ups of the phone UI and of outputs.
- Main chat model: Fable 5.2. No agents. This chat wrote no app code; it wrote a spike, the spec and the backlog.
- 18:40 to 18:54. Read the export and the groovebox notes. Instead of mock-ups, wrote a working spike: one canvas engine (Swiss, Postmodern; five graphics; three formats; three seeds), a phone UI, a 6 s clip assembled with ffmpeg. Published a plan page with a live demo. One web search to check MP4 recording in Chromium. Named it "Raster" as a working name.
- 18:54. Pedro: stills first, then motion; wants editable palettes, font pairings "via type wolf", graphic generation, light and dark, Simple and Advanced; asked which styles to start with. Chat recommended three styles with grunge as a finish, not a style, and Brutalist if a fourth was wanted.
- 18:57. Pedro: "Brutalist is the fourth. HEEEEEEAVY TYPE. i love the post modern style you got there. The swiss as well. Let's go. The app will be called RSTR". Chat added first-pass Brutalist and Vaporwave to the spike, wrote `CLAUDE.md`, `SPEC.md`, `RUN.md`, `BACKLOG.md` (R1 to R12), and pushed the seed to `apcanario/rstr` (the repo already existed, empty). Error made and fixed: a page rebuild script failed on one replacement and an old page was published under the new title for about a minute.
- 19:15 to 19:17. Pedro sent two pairing articles and his own picks, then interrupted a licence-checking command to say fonts should be fetched online and/or bundled in the APK, and: "forget about shomen branding for now. That was an example. Reuse the visual elements though!" One article opened, one did not. Chat wrote `pairings.md` (42 pairings), `elements.md` (marks and effects from the old engine's specs), rewrote spec 6 and 7, pushed. Font families were not verified one by one; left to R3.
- 19:21. Pedro asked for the first Sonnet prompt; given. Bundle 1 started in another chat.
- 20:17 to 20:28. While bundle 1 ran, Pedro narrowed and widened scope: "I dont want to add my own fonts or palettes, i want the app to be plug and play"; one uploaded photo that Shuffle moves, monochrome or duotone; per-image palette edit at most; later, add and remove text layers with hierarchy; more variety; export resolution and format; "a jpg that's printable up to A3". He said not to touch GitHub while the session ran. Chat held all changes locally and updated only the plan page.
- 20:33. Pedro: all styles need more composition variety at every level; Swiss bolder and combining approaches ("topo with dots, lines with solid shapes"); Postmodern to gain "Ray Gun, Nirvana-esque grunge post modern photocopy noise alongside the ice cream post modern". Chat extended the spike (combinations, tilts, a quarter turn, bolder ranges, a lines graphic; a photocopy dialect with a copier pass), fixed unreadable words with a paper edge after looking at the first sheet, sent ten samples.
- 20:38. Pedro approved both in strong terms ("THIS IS IT"). Those samples became `refs/v2-*.jpg`.
- 20:39 to 20:40. Pedro asked for a style combinator later, "experimental and suited for advanced users". Chat made the five-parts rule a requirement from R5 so it stays possible.
- 20:54. Pedro asked for the changelog and backlog to be kept thoroughly so the process can be analysed. This file and the rules in `RUN.md` section 4 and 5 are the result.
- 20:58. Pedro asked how to add the same record-keeping to the groovebox repo; answered, nothing done there.
- 22:31. Pedro reported bundle 1 closed and asked for the revision to be pushed, with the plan page kept in the repo. Bundle 1 had closed R1 to R4 and its viewer check and had not touched the spec. The revision was laid on top of `main` keeping bundle 1's backlog, Carried, Done, changelog and reviews as written. Row ids were kept stable (new rows R13 to R18) because Carried items and review files already named R5 to R10; the first local draft had renumbered them and was corrected before landing.
- 22:34 to 22:35. Pedro asked whether bundle 2 should be two chats; told it stops itself after a closed row, with the option to split if he wanted to look in between. Pedro: "Yeah i do." Bundle 2 split into 2 (R13, R5) and 3 (R6, R7); later bundles renumbered 4 to 7.
- Choices taken without asking (all listed to Pedro at the time): grunge as a finish; four seeds; hand-made dark palettes; a layout solver that rejects illegal layouts; story text zone from his earlier posts; marks as a layer, not a style; micro labels carry only what the spec knows; photocopy as a dialect of Postmodern.
- Checks: spike output judged by eye from contact sheets; the plan page opened in headless Chrome at phone width after each rebuild, no errors, no sideways overflow. Nothing else was tested.
- Usage: not visible.
- Not done: the Muzli article was never read; no font family was verified against Google Fonts; Brutalist and Vaporwave did not get the variety pass.
