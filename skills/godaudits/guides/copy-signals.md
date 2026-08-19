# Copy signal interpretation

Copy signals narrow the lines a domain evaluator must read. They are not an
authorship detector, a style score, or an automatic finding. The source line,
its rendered destination, its claim, and its evidence decide the outcome.

## Signal set

The static collector emits eight high-confidence kinds on reader-facing paths:

| Kind | Candidate meaning |
|---|---|
| `copy-puffery` | ceremonial importance with no fact |
| `copy-promotional` | broad marketing promise with no mechanism |
| `copy-vague-attribution` | unnamed source presented as support |
| `copy-formula` | stock contrast or challenge frame |
| `copy-filler` | removable setup that adds no decision or fact |
| `copy-hedging` | stacked uncertainty that hides the actual confidence |
| `copy-chatbot-residue` | conversational wrapper addressed to a chat user |
| `copy-generic-conclusion` | closing sentence with no next fact or action |

The collector reads Markdown, MDX, HTML, JSX, TSX, Vue, and Svelte. It also
reads message-oriented JavaScript, TypeScript, JSON, text, and YAML under
marketing, site, email, locale, message, and launch directories. It excludes
test and fixture directories, release history, licenses, notices, generated
prompts, Markdown code fences, and indented Markdown code.

## Judgment boundary

For every signal:

1. Re-open the path and line recorded in EVIDENCE.json.
2. Confirm that the line reaches a reader-facing surface.
3. Read the complete sentence and the evidence supporting its claim.
4. Drop quoted examples, historical text, precise technical terms, and claims
   that name their mechanism, source, or measured result.
5. Route a survivor to its owning check and refute it like any other finding.

The semantic pass also inspects patterns that a conservative regex cannot judge
safely: passive voice, contentless participial clauses, dense sentences,
adverbs, formulaic contrasts, synonym cycling, and false ranges. None fails on
form alone.

## Ownership

- Product records and README promises belong to A-PRD-3 and A-PRD-11.
- Rendered labels, errors, help, and CLI messages belong to A-UX-6, A-UX-7,
  and A-UX-20.
- Landing, email, and channel copy belongs to A-LAUNCH-1, A-LAUNCH-6,
  A-LAUNCH-7, and A-LAUNCH-22.
- Audit report prose belongs to the exemplar quality gate. It does not create a
  finding against the target repository.

## Provenance

The taxonomy was informed by the pstack `unslop` skill by Lauren Tan. The
implementation narrows its phrase categories into evidence leads and keeps
contextual writing judgments out of the deterministic runtime. See the project
NOTICE for license attribution.
