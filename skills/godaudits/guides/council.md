# Council review (opt-in)

A council is a finished audit read by three or more independent agents from
distinct harnesses, read-only, in at most three rounds. Each seat tries to
disprove the audit's claims from the cited code, the lead triages what comes
back, and the deterministic runtime keeps the ledger. The lead keeps scope: a
council makes the audit more correct, it never makes the audit bigger.

The pattern follows the council idea in the tstack skill collection: several
strong models from different providers, read-only, scored rounds, a lead who
fights scope creep. This guide is written for godaudits and its runtime
contracts.

## When it runs

- After the Phase 7 render and before presenting, never earlier.
- Only when `audit.capabilities` includes `council`. The runtime refuses to plan
  or apply a council without it.
- Only on the user's explicit request or authorization. It is never a default
  and never a quiet upgrade of a normal audit.

## Egress consent

Council sends the audit, the refutation briefs, and the cited code to each
seat's provider. That is outbound disclosure of the repository to third parties.

- Never run it on private code without the user's explicit authorization that
  names the seats (harness and provider) and the repository.
- Record the `council` capability only after that authorization.
- Free or unmetered models see public code only. Treat anything sent to them
  as public.
- Secrets never go into the packet: the runtime redacts what seats return, but
  it cannot recall what a seat has already read. If the repository holds live
  secrets, say so to the user before asking for authorization.

## No substitution

A council needs three distinct harnesses. If fewer than three are reachable,
report which are missing and stop. Three agents from one harness are not a
council: they share a tool, a prompt path, and usually a training lineage. Never
present a round as converged when `godaudits council apply` reports it
incomplete, and never fill a seat with a second copy of another seat.

Distinct providers matter too. Fewer than three distinct known providers adds a
`reduced-decorrelation` warning; report it. A provider recorded as `unknown`
(for example Cursor Auto, which routes the model itself) is allowed but does not
count toward the three.

## Agent count

One agent per seat per round, given the whole packet. Never one agent per
finding: a per-finding agent cannot see what the others contradict, and the
round's completeness rule needs every seat to answer every brief.

## Read-only seats

Seats read; they do not edit.

1. Before each seat runs, record `git status --porcelain -- . ':(exclude).godaudits'`.
2. After it runs, record it again. Any difference means the seat changed
   something outside `.godaudits/`.
3. Any such edit voids that seat's response. Revert nothing you did not make,
   tell the user what changed, and rerun that seat only if the user agrees.

The orchestrator, not the seat, writes the response file. A seat run in a plan
or read-only mode returns its answer as text; extract the JSON object and save
it as `.godaudits/council/ROUND-<round>-<harness>.json`.

Before saving, the orchestrator overwrites the `seat` block with what it
actually invoked, whatever the seat returned: `harness` is the tool it ran,
`model` is the model id exactly as passed on that command line (`auto` for
Cursor Auto), `effort` is the effort it passed (or null), and `provider` is the
vendor of that model (`unknown` when the tool routes the model itself). The
distinct-harness rule is only as honest as this step, because a model's
self-report of what it is cannot be trusted. The runtime cannot verify it; it
rests on the orchestrator. Keep `round` and `audit_sha256` as the seat copied
them, since `apply` checks both.

## The round loop

```bash
godaudits council plan .godaudits/AUDIT.json --ledger .godaudits/COUNCIL.json
godaudits council apply .godaudits/AUDIT.json .godaudits/council/ROUND-1-*.json --repo . --ledger .godaudits/COUNCIL.json
godaudits council triage .godaudits/COUNCIL.json .godaudits/council/DECISIONS-1.json
godaudits council render .godaudits/COUNCIL.json --output .godaudits/COUNCIL.mdx
```

Omit `--ledger` only for round 1. Once a `COUNCIL.json` exists beside the audit,
the runtime refuses a run that does not name it, so a round never restarts by
accident. `apply` and `triage` write the ledger in place, or a new file;
they refuse an `--output` that names any other existing file, so history is
never replaced. `plan` writes the packet to `council/PACKET-<round>.json`, a
name the `ROUND-<round>-*.json` response glob cannot match.

1. **Plan.** `council plan` writes the packet: the audit hash, one refutation
   brief per open Critical or High finding, the objections earlier rounds
   dismissed, the response contract, and the seat instructions. It refuses while
   the previous round still has untriaged objections, and after convergence or
   the third round.
2. **Run the seats.** One agent per seat, whole packet, read-only. Each answers
   every brief from the cited code before reading the AUDIT.mdx narrative.
3. **Apply.** `council apply` rejects a response whose audit hash does not match,
   whose round is not the open round or the next one, whose seat fields are
   missing, or whose harness repeats within the round. It checks every
   citation against `--repo`, redacts every quote, claim, and note, merges
   identical objections across seats, and computes the status.
4. **Triage.** The lead decides every open objection: `accepted` or `dismissed`.
   A dismissal needs a one-line reason. An objection whose citation did not
   verify (`citation-failed`) or whose target does not exist (`rejected-target`)
   needs no triage and can never be accepted. Triage closes the round.
5. **Fix.** Repair accepted objections through the normal method: reopen the
   evidence, update the check outcome or finding in AUDIT.json, then
   `godaudits validate .godaudits/AUDIT.json --repo . --write` and re-render
   AUDIT.mdx. Never hand-edit derived scores, counters, or rendered files.
6. **Repeat** from plan, until the status says stop.

`DECISIONS.json` is an array:

```json
[
  { "objection": "O-1-1", "status": "accepted", "reason": "Guard is real; narrow the finding." },
  { "objection": "O-1-2", "status": "dismissed", "reason": "The cited line is test-only code." }
]
```

### Stop rule

Stop when a round produced no new accepted objections, or after three rounds.

| Status | Meaning |
|---|---|
| `needs-triage` | Open objections remain in the latest round. |
| `continue` | The round was triaged with at least one accepted objection and fewer than three rounds ran. Fix, then plan the next round. |
| `converged` | The latest round was complete and has zero open and zero accepted objections. |
| `round-cap` | Three rounds ran without convergence. Present what remains. |
| `incomplete` | The latest round lacks three distinct harnesses, or a seat omitted a verdict. It cannot converge. |

At the third round an incomplete round that is triaged, or has no open
objection left to triage, is `round-cap`, with its gaps listed as what remains.
Run every seat for a round in one `apply` call, especially in round three.

A seat's response cannot be replaced within a round, and a harness cannot appear
twice. That is deliberate: re-running a seat until it agrees would let the lead
cherry-pick verdicts. A seat that omitted a verdict leaves the round incomplete;
triage what it raised and run the next round with every seat.

A round that dismisses every objection with a reason converges. A repeated
objection that an earlier round already dismissed (`repeat-dismissed`) does not
block convergence.

### Confidence

The finding tally records `standing` (all seats found no refutation),
`contested` (seats split), or `challenged` (every seat refuted or weakened). Only
a challenge whose guard citation verified counts: an unverified challenge stays
listed with `guard_verified: false` and changes neither the result nor the
ceiling. A verified challenge keeps the ceiling even when the lead later
dismisses its objection.
Contested and challenged findings carry a `Firm` confidence ceiling for the
next re-audit: a finding recorded Certain is recorded Firm or lower there, and
the re-audit applies the ceiling, never the lead's judgment of the seats.
Unanimous agreement adds no evidence and changes nothing. The council can
lower a finding's confidence and never raises it, and a seat's guard citation
never becomes corroboration of the finding it tried to refute.

## Why scores never gate

Each seat may grade the audit's quality from 0 to 100. The number is recorded
per seat per round, shown in the council table, and used for nothing else.

- Ground rule 10: scores are compiled by the runtime from the catalog, never
  typed from judgment. A reviewer's number would be a hand-typed score.
- After round one the reviewers are grading their own suggestions, so a rising
  number measures how much the lead complied, not how correct the audit is.
- Pleasing reviewers by dropping findings is the more dangerous error. A clean
  council is not a reason to delete a finding that has evidence, and a harsh
  score is not a reason to add one that does not.

The runtime keeps no average, no threshold, and no field that reads a score.
Do not add one in chat either: never say a council "passed" because scores were
high, and never gate the verdict or the compiled score on them.

## Scope guard

Accepted objections fix the audit. They never widen its destination, its domain
selection, or its budget, and they never turn an audit into a rewrite request.

- A `missed` objection that falls outside `audit.destination` or the selected
  domains is an out-of-scope note for the user, not a new finding. Dismiss it
  with that reason.
- A missed issue inside scope still needs the normal evidence and refutation
  discipline before it becomes a finding.
- Do not run extra rounds to chase a score or to soften a verdict.

## Presenting results

Put the council table in the chat summary and in the pull request description
when the audit ships in one. Use the rendered `## Council review` section:

- rounds run and the stop status;
- the seat-by-round score table (a seat with no score reads `no score`);
- the finding tally and any confidence ceilings;
- objections by status, with the lead's reasons;
- every warning, including `reduced-decorrelation`, and what remains at the cap.

State plainly when the council was incomplete or capped. Do not describe a
non-converged council as agreement.

## Default seats

The user may change the seats. Verify every flag against the CLI's own `--help`
at run time, because these tools change. Use high effort, never above xhigh,
and never set effort through environment variables.

| Seat | Command |
|---|---|
| Claude Code | `claude -p --model claude-opus-5-5 --effort high --permission-mode plan "<prompt>"` |
| Codex | `env -u OPENAI_API_KEY -u CODEX_API_KEY codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" -s read-only --output-schema <skill>/schemas/council-response.schema.json -o <response file> "<prompt>"` |

The third seat is Antigravity, Cursor, or both. There is no Gemini API or
Gemini CLI seat.

- Antigravity, inside an Antigravity session:
  `~/.gemini/antigravity/bin/agentapi new-conversation --model=gemini-3.8-flash-high --title="godaudits council round N" "<prompt>"`
- Antigravity, from another host through T3 Code:
  `t3 thread start --provider antigravity --model gemini-3.8-flash-high --wait --title "godaudits council round N" . "<prompt>"`
- Cursor: `agent -p --mode ask --model auto --output-format text "<prompt>"`.
  Record model `auto` and provider `unknown` unless Cursor reports the routed
  model. Never pin a Cursor model or enable Max Mode.

`<skill>` is the installed skill directory. The response schema is in strict
structured-output shape (every property required, optional values nullable, no
additional properties), so Codex accepts it directly. Other seats receive the
same contract in the prompt and return the JSON object as text.

## Seat prompt template

Replace the angle-bracket fields. Give every seat the same text.

```text
You are one seat in a read-only council reviewing a finished code audit.
Do not edit, create, or delete any file. Do not run the project or its tests.
Do not make network calls.

Read the council packet at <packet path>. It holds the audit hash, one brief
per open Critical or High finding, the objections the lead already dismissed,
and the response contract. The audit is at <AUDIT.json path>. The repository
is your working directory.

For every brief in required_verdicts, read the cited code and try to disprove
the claim: look for guards, framework defaults, dead code, and compensating
controls. Decide this from the code before you read AUDIT.mdx. Return one
verdict per brief:
- refuted: a guard makes the defect unreachable. Cite the guard.
- weakened: the claim holds but narrower than stated. Cite the guard.
- no-refutation: you looked and the claim stands.

Add an objection only when you can cite code: kind refute or weaken against a
finding, missed for an issue the audit did not record (target the finding or
check id that would own it), or evidence when a citation is stale or too thin.
Every citation is {path, line, quote}: a repository-relative path, a 1-based
line, and a verbatim quote within 3 lines of that line. Do not re-raise
anything listed in dismissed_objections.

Optionally set score to an integer from 0 to 100 grading how good the audit
is, not the codebase, or null. It is recorded and never used to accept or
reject anything. Silence is not agreement: a missing verdict makes your seat
incomplete.

Answer with one JSON object and nothing else, in this shape. Copy round and
audit_sha256 from the packet. Put any non-empty placeholder in each seat field:
the orchestrator replaces the seat block with what it actually invoked, so do
not describe yourself.
{"round": <n>, "audit_sha256": "<hash>", "seat": {"harness": "seat",
"provider": "seat", "model": "seat", "effort": null}, "score": null,
"verdicts": [{"finding": "F-...", "outcome": "no-refutation", "guard": null,
"note": null}], "objections": []}
```
