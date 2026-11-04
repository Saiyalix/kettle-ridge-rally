---
name: ship-a-build
description: Finish a piece of work on Kettle Ridge Rally and hand it to the owner - run the full QA test kit, get the qa verdict, push the branch and open a pull request with a plain-language summary and a phone test checklist. Use when a change is ready for the owner to review.
---

# Ship a build

1. **Branch check.** You are on a task branch, not `main`. `git status` is clean apart from the intended changes.
2. **Build and test.** `node tools/build.js` (rebuilds `index.html` from `src/`), `npm install` if `node_modules` is missing,
   then `node tests/run.js`. If anything is FAIL, stop and fix it
   (or send it back to the owning department). Do not open the PR with a FAIL.
3. **QA verdict.** Ask the `qa` department to review the branch. It writes `READY TO MERGE` or `NOT READY`.
   If NOT READY, fix and repeat from step 2.
4. **Docs.** Roadmap item moved? Update `docs/roadmap.md`. Rule, target or expected value changed? Entry in `docs/decisions.md`.
5. **Commit `src/` and `index.html` together** and push with a clear message, `git push -u origin <branch>`.
6. **Open the PR** with this description (fill every part, keep it short, no jargon):

```markdown
## What changed
<2–4 plain lines>

## Why
<1–2 lines>

## Test results
<summary line from tests/results/report.md, e.g. "74 pass · 0 fail · 1 known">
<before → after numbers if gameplay changed>

## Test it on your phone
After merging, open https://saiyalix.github.io/kettle-ridge-rally/ (wait ~1 minute for Pages to update, then refresh).
- [ ] Hold the phone sideways; the menu shows and Start works
- [ ] <stage + what to do + what you should notice>
- [ ] <second thing to try>
- [ ] Touch buttons respond; nothing covers them

## Risk
<"Low: …" or say plainly what you are not sure about>

## QA verdict
<paste the qa verdict block>
```

7. Tell the owner in chat: the PR link, one line on what to try, and the risk line.
