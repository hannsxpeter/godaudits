#!/usr/bin/env bash
# Release-grade local evidence. Requires the pinned official validator.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_DIR="$REPO_DIR/skills/godaudits"
EVIDENCE_NODE="$(mktemp)"
EVIDENCE_PILLARS="$(mktemp)"
trap 'rm -f "$EVIDENCE_NODE" "$EVIDENCE_PILLARS"' EXIT

if [ -n "${SKILLS_REF_BIN:-}" ]; then
  VALIDATOR="$SKILLS_REF_BIN"
elif command -v skills-ref >/dev/null 2>&1; then
  VALIDATOR="$(command -v skills-ref)"
else
  printf '%s\n' "[fail] skills-ref is required for release validation." >&2
  printf '%s\n' "Install the pinned validator in an isolated environment:" >&2
  printf '%s\n' "  python3 -m venv .venv-skills-ref" >&2
  printf '%s\n' "  .venv-skills-ref/bin/pip install -r requirements/skills-ref.txt -r requirements/schema-validator.txt" >&2
  printf '%s\n' "Then set SKILLS_REF_BIN=.venv-skills-ref/bin/skills-ref and rerun." >&2
  exit 1
fi

if [ -n "${PYTHON_BIN:-}" ]; then
  PYTHON="$PYTHON_BIN"
elif [ -x "$(dirname "$VALIDATOR")/python" ]; then
  PYTHON="$(dirname "$VALIDATOR")/python"
else
  PYTHON="$(command -v python3)"
fi

cd "$REPO_DIR"
bash -n scripts/*.sh
npm run check
"$VALIDATOR" validate "$SKILL_DIR"
node bin/godaudits.js evidence benchmarks/fixtures/node-api --output "$EVIDENCE_NODE"
node bin/godaudits.js evidence test/fixtures/pillars-routing --output "$EVIDENCE_PILLARS"
"$PYTHON" scripts/validate-evidence-schema.py skills/godaudits/schemas/evidence.schema.json "$EVIDENCE_NODE" "$EVIDENCE_PILLARS" --assert-contract
npm pack --dry-run
node bin/godaudits.js doctor
printf '%s\n' "Local release checks passed."
