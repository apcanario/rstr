# How a chat runs

Every build chat starts from the same two lines, which also resume a chat that stopped:

```
Clone apcanario/rstr (shallow, push access).
RSTR, next bundle. Thin main chat on Sonnet 5.5; every agent a fresh Opus 5.5 agent. Read docs/RUN.md and work the next open bundle of docs/BACKLOG.md in full, unattended.
```

Pedro may add a third line starting `Notes:` with what he saw on the phone.

## 1. The main chat is thin

- It runs on Sonnet 5.5 and records the model it actually ran as.
- It reads `CLAUDE.md`, this file, and the rows of the bundle in `docs/BACKLOG.md`. It does not read source files, the spec or review reports.
- One chat works one whole bundle, row by row, in order.
- It launches agents one at a time, each a fresh Agent on model `opus`, and reads only each agent's reply (six lines at most) and the output of the scripts.
- Scripts judge the result, not the chat: `npm run check` and `npm run smoke`.
- If the session refuses to run the repo's scripts, stop, say so in one line and ask. Never work around it.
- Where a choice is open, take the most reasonable reading, record it under Choices in the changelog and carry on. Ask only if blocked. Pedro vetoes afterwards; he does not confirm beforehand.

## 2. Notes first

Before any row: Pedro's `Notes:` line if there is one, then the **Carried** list at the top of `docs/BACKLOG.md`. Give both to the first builder as fixes to make before the row's own work. A note that is a matter of taste (too busy, title too small, that colour is ugly) is a fix like any other. A note that contradicts `docs/SPEC.md` changes the spec: the builder edits the spec in the same commit and the changelog says so.

## 3. One row, three agents

**Builder.** Prompt: the row id; "read `CLAUDE.md`, `docs/SPEC.md` and row <id> in `docs/BACKLOG.md`, look at `docs/design/refs/`, then build the row in full"; the notes and carried items that apply; "run `npm run check`, `npm run smoke` and `npm run sheet` until the first two pass, look at the sheets yourself and fix what is plainly broken, commit on `main` without pushing, reply in six lines or fewer: what was built, what was left out and why".

**Reviewer.** A new agent that has not seen the build. Prompt: the row id and the commit before the builder started; "read `CLAUDE.md`, `docs/SPEC.md` and the row, then review `git diff <base>..HEAD` against them; run `npm run check`, `npm run smoke` and `npm run sheet`; open the sheets and the screen shots and look at them; write `docs/reviews/<row>.md` listing every finding as error, should-fix or minor, each with file, line and the fix, and for a design that is legal but clumsy the spec that makes it; end with a verdict: pass, fix or rebuild; change no source file; reply in six lines or fewer with the verdict and the counts". The reviewer looks hardest at: any Done-when line that is not true, an invariant of spec 9.2 that the smoke run does not really check, a style that has drifted from its refs, text that wraps or is cut on a control, controls under 48 px, `Math.random()` anywhere but seed creation, logic without tests.

**Fixer.** A new agent. "Read `docs/reviews/<row>.md` and apply every finding, minor ones included; where a finding is wrong, say why in the report instead; run the scripts until they pass; commit; reply in six lines or fewer."

- Verdict **rebuild:** discard the builder's commits (`git reset --hard <base>`), run a new builder with the review report as extra input, then review again. One rebuild per row. A second rebuild verdict stops the chat with a report.
- Verdict **pass** with no findings: skip the fixer.

## 4. Close the row

1. The chat runs `npm run check`, `npm run smoke` and `npm run sheet` itself. The first two must pass.
2. Update `docs/BACKLOG.md`: move the row to Done as one line (id, title, date closed, how many chats it took, link to its review file). Add anything found but not fixed to **Carried**, with an id, the date, the row that found it and the row that should fix it. A Carried item is removed only by the row that fixes it, and that row's changelog entry names it. Nothing leaves the backlog without a trace in the changelog.
3. Update `README.md` as `CLAUDE.md` says.
4. Add the row to `docs/CHANGELOG.md`: date, row, the model each agent actually ran as, what changed (files and behaviour), the review (verdict, counts of error, should-fix and minor, how many applied, each one rejected and why, rebuilds), script results with test counts and anything flaky, choices taken, and which Carried items the row cleared or added, by id. Do not shorten an entry to save room; a thin entry is a defect.
5. Commit and push `main`. Check the Pages deploy if the session can see it; if it cannot, say it is unverified.
6. Start the next row. Each row is pushed before the next begins.

## 4b. Close the bundle

After the last row is pushed, one more fresh agent, the **viewer**, checks the bundle as a whole on the final build: "read `CLAUDE.md`, the spec sections the bundle names and those rows; build; run all three scripts; go through every Done-when line of every row again and say for each whether it is true now; look at every sheet and every screen shot for what a script cannot judge (clumsy designs, cut or wrapped text, a control under 48 px, a style off its refs); check that `README.md` describes what the app does now; write `docs/reviews/bundle-<n>.md`; change no source file; reply in six lines or fewer". Findings go to a fixer as in section 3; what cannot be fixed goes to **Carried**.

## 4c. Keeping quality across a long chat

- The main chat stays thin so a bundle of up to four rows fits.
- The reviewer checks that every Done-when line marked "(tested)" has a test that would fail if the line were false.
- If the chat is running out of room, it stops after closing the current row (never mid-row) and gives the reply. The same starter resumes at the next row.
- A row is never skipped. If a row cannot be finished, the chat stops there and says why.

## 4e. The plan page

`docs/plan.html` is the plan as one page, the same page Pedro reads as an artifact. When a bundle closes, the chat changes that session's state tag in section 07 of the page (`Queued` or `Next` to `Done`, with the date, and the next one to `Next`) and nothing else in the file. A design chat that changes the plan rebuilds the page and replaces the file.

## 4d. The process log

Before its last push, every chat adds its entry to `docs/PROCESS.md` in the format and under the rules given there: what actually ran, every agent in order, every verdict, every failure, Pedro's words verbatim, nothing estimated. A chat that stops early writes its entry before stopping. The first build chat after this section lands (bundle 2) also writes the entry for bundle 1 from what the changelog, the review files and `git log` show, and marks it as reconstructed.

## 5. The reply

One reply at the end of the chat, in this order:

1. **Built:** per row, three lines at most.
2. **Review:** verdict and counts per row, how many findings were applied, and the viewer's result.
3. **Choices:** each open choice taken, one line each, so Pedro can veto.
4. **Look at:** the contact sheets of the styles the bundle touched, sent as image files in the chat, and three to five specific things to try on the phone. This is the only test that matters.
5. **For Pedro by hand:** only what no agent can do. Repeat every open item from the backlog's By-hand list until he says it is done.
6. **Next:** always last, never left out, also when the chat stopped early. One line naming the next open bundle and what it builds, then the starter in a code block with an empty third line `Notes:`.

## 6. When to leave this model

Building a row from the spec does not need Fable. Use a Fable chat only when the spec itself has to change shape: a new style, motion, photos, kits. That chat rewrites `docs/SPEC.md` and the backlog rows, and builds nothing.
