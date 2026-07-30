Run the full Budget-Buddy feature pipeline for: $ARGUMENTS

Execute these stages in order. Do not skip ahead. After each stage, confirm the handoff file exists before starting the next. Do NOT merge or push anything — leave the branch for morning review.

0. Reset handoffs: delete any existing contents of `.pipeline/` so no stale files are read.
1. Delegate to the `planner` subagent with the feature request above. Wait for `.pipeline/spec.md`.
2. If `.pipeline/spec.md` contains OPEN QUESTIONS, STOP and show them to me. Otherwise delegate to the `coder` subagent. Wait for `.pipeline/changes.md`.
3. Delegate to the `tester` subagent. Wait for `.pipeline/test-results.md`. If the gate failed, STOP and show me the failures.
4. Delegate to the `reviewer` subagent. Wait for `.pipeline/review.md`.
5. Show me `.pipeline/review.md` and report the final verdict (SHIP / NEEDS WORK / BLOCK). Do not merge.
