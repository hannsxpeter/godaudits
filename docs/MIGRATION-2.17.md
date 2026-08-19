# Migrating evidence schema 1.1 to 1.2

godaudits 2.17 changes newly generated EVIDENCE.json files from schema 1.1 to
1.2. The record shape is unchanged. The `signals[].kind` enum adds eight
`copy-*` values for reader-facing phrase candidates, and the fingerprint gains
a limitation explaining their judgment boundary.

Existing schema 1.1 evidence can still initialize an audit. Regenerate evidence
before a re-audit or freshness check so the fingerprint includes the new signal
set:

```bash
godaudits evidence . --output .godaudits/EVIDENCE.json
```

Do not convert a copy signal directly into a finding. Reopen its path and line,
confirm that the text reaches a reader, read the complete claim, search for its
support, and route a surviving defect to product, UX, or launch ownership. The
[`copy-signals` guide](../skills/godaudits/guides/copy-signals.md) defines the
path scope and interpretation rules.
