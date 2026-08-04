# Wayfinding: the remediation plan as a map

## In plain terms

An audit hands you a repair plan with a lot of tasks in it. A numbered list of
those tasks tells you what the audit decided. It does not tell you what you can
pick up right now, what is waiting on something else, what somebody else has
already started, or what the audit deliberately did not look at.

`wayfind` reads the same plan as a map instead of a list. It answers four
questions:

- **Where am I going?** The destination, and how you will know you arrived.
- **What can I start right now?** Tasks with nothing left blocking them and
  nobody else working on them.
- **What is in the fog?** Things inside the scope that this audit could not
  resolve, which lower confidence in the grade.
- **What was ruled out?** Things deliberately placed outside the scope, which
  do not lower confidence in anything.

Those last two look similar and mean opposite things, which is why they are
never merged into one "not covered" list. The rest of this document is the
mechanics.

## Why a list was the wrong shape

An audit ends with a task graph. Until version 2.13 godaudits rendered that
graph as a list: phases, waves, and a checkbox per task. A list is the right
shape for authoring a plan and the wrong shape for working one. It answers
"what did the audit decide" and not "what can I start now", and it says nothing
about what the audit consciously did not cover.

This borrows the reader's view from the wayfinder skill
(<https://github.com/mattpocock/skills>, `skills/engineering/wayfinder`, MIT),
which charts work too large for one agent session as a shared map and works its
frontier one item at a time. godaudits already built the graph wayfinder
assembles by hand. What it lacked was the discipline for reading it back.

Run it:

```bash
godaudits wayfind .godaudits/AUDIT.json
```

`--format json` returns the same map as data. `--output file` writes instead of
printing. Flags are space-separated; `--format=json` is not parsed.

## What it reports

### Destination

Read before anything is chosen. `audit.destination` is one or two sentences of
prose saying what reaching the end of the plan looks like, and the final
re-audit gate's acceptance conditions are its machine-checkable form. The
destination fixes the scope, which is what makes the out-of-scope boundary
below meaningful rather than arbitrary.

An audit that states no destination is reported as stating none. It is not
silently omitted, because a plan with no stated end is a real gap in the
handoff, not a formatting detail.

### Frontier

The open tasks whose every dependency is closed and which no session has
claimed. This is the answer to "what can I start now", and the phase-and-wave
listing cannot give it: waves are an authoring order fixed when the plan was
written, while the frontier moves every time a task closes.

Three rules make it correct rather than approximately correct:

- A `superseded` dependency counts as closed. A replaced task will never
  complete, so treating it as an open blocker would strand every dependent
  forever.
- The final re-audit gate is the destination, not a member of the route. It
  depends on every task by validation rule, so counting it as an ordinary
  blocked task would put one permanently unreachable entry in every map and
  credit every task with the same meaningless unblock.
- `unblocks` counts how many other open tasks a task directly releases. When
  two tasks are equally takeable, that is the ordering signal.

The frontier also names file conflicts. Validation rejects parallel file
overlap inside a single wave, but across waves the overlap is legal state, so
two frontier tasks touching the same file are reported as a conflict before a
second session claims one.

### Claim

`task.claim` is `{ "owner": "...", "claimed": "YYYY-MM-DD" }`. A session claims
a task before starting work, so a concurrent session skips it; an open
unclaimed task is free to take. Validation rejects a claim on a task that is no
longer open, where it would read as work in flight that is not.

Claims are authored like every other audit field and applied through the
compiler. There is deliberately no `wayfind claim` writer command: a
read-modify-write of AUDIT.json with no lock would create the very race it
claims to prevent while advertising atomicity it does not have.

### Not yet specified

In scope and unresolved. Two shapes, separated by sharpness:

- **Unknown checks** are questions the catalog already phrases precisely and
  this audit left unanswered. An unknown check may carry a `question`: the
  precise question whose answer resolves it. That question is what makes an
  unknown takeable instead of merely uncounted. The map reports how many
  unknowns carry one, because an unknown with no stated question is a gap the
  audit did not even describe.
- **`not_yet_specified`** is the dimmer view: `{ domain, gist, revisit_when?,
  checks? }` for a lead this audit can see coming but cannot yet phrase as a
  check. The test is whether the question can be stated precisely now, not
  whether it can be answered now. Stateable means it is a check. Not stateable
  means it belongs here.

Two rules keep the fog honest. Its domain must be applicable, because fog only
gathers toward the destination and a lead in an excluded domain is a scope
decision wearing fog's clothes. Any check it names must still be unknown,
because fog that graduated into a resolved check is cleared rather than
restated; otherwise a map keeps telling its reader that settled ground is
unmapped.

There is no rule requiring every unknown check to carry a question, and that is
deliberate. A fresh audit initializes every check to unknown, and a
medium-budget audit holds every deep-trace check unknown by design. A gate
nobody can pass is worse than an honest counter.

### Out of scope

Excluded domains with their reason, and not-applicable checks with their
absence evidence. Scope, not sharpness, lands work here. It never graduates
inside this audit and never enters the remediation route; redrawing the scope
is a fresh audit, not a resumption of this one.

Fog and scope are reported as separate sections for one reason: collapsing them
into a single "not covered" list lets a coverage gap read as a deliberate
boundary, or a deliberate boundary read as a coverage gap. The first
understates risk and the second overstates it.

### Open questions

The human lane. `open_questions` carries question, owner, due date, and the
default if unanswered. Some decisions do not resolve by reading code, and an
agent that answers its own open question has not resolved it; it has stood in
for the person who owns it.

## Refer by name, never by a bare id

A remediating agent reading `Depends on: GA-104, GA-107` has to go look both up
before it knows whether it can start. The same line carrying titles reads at a
glance, and the id still rides inside the name, so machine traceability is
unchanged. The generated report now writes every task and finding reference
that way.

Check ids stay bare. Their titles live in the catalog rather than in
AUDIT.json, so naming them would make the report depend on catalog
availability, and the plan-aware mirror already uses that slot for the godplans
R-id.

## Why it is derived on read

The frontier is not written into `computed`. Derived score state is compiled
once and compared for staleness, which is right for a score and wrong for a
frontier: a frontier committed into the audit record is stale the moment a task
closes. `wayfind` compiles nothing and mutates nothing, so it stays correct on
a half-written plan and immediately after a status flip, and a stale frontier
can never be committed.

The same reason drives the guidance in the report itself: re-derive the
frontier after each close rather than reading it from a rendered report that
may be older than the task state.

## Compatibility

Every wayfinding field is optional. An audit written before version 2.13
validates unchanged and still produces a map: it reports no stated destination,
no fog entries, and zero unknowns carrying a question. This matters because the
committed dogfood and detector artifacts are evidence records, and a schema
change that forced them to be rewritten would be a change to published
evidence.
