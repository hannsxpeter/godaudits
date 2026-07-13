#!/usr/bin/env bash
# scripts/lint.sh: meta-linter for godaudits.
#
# Mechanically enforces the discipline rules. Replaces "the rule says X"
# with "CI fails if X is violated."
#
# Checks (run with --all, default):
#
#   unicode-clean        no em dashes, en dashes, Unicode arrows, box-drawing
#                        characters, smart quotes, ellipsis characters, or
#                        emojis in any authored file.
#   frontmatter-version  SKILL.md metadata version matches the top CHANGELOG
#                        entry and the body "Skill version" line.
#   description-length   SKILL.md description is 1-1024 characters (Agent
#                        Skills spec bound).
#   dir-name-match       skill directory name matches frontmatter name.
#   references-exist     every references/<file>.md named in SKILL.md exists.
#   modules-complete     every reference module has the six contract sections.
#   symlinks-valid       .agents/skills and .claude/skills projections resolve.
#   catalog-fresh        the generated 414-check machine catalog is current.
#   schemas-valid        every committed JSON and schema document parses.
#   runtime-tests        compiler, renderer, evidence, eval, and interop tests pass.
#   benchmark            the deterministic multi-language corpus passes.
#   prompt-fresh         both portable prompts match build-prompt.sh output.
#
# Usage: bash scripts/lint.sh [check-name | --all] [--verbose]
# Bash 3.2 compatible (macOS default).

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_DIR="$REPO_DIR/skills/godaudits"
VERBOSE=0
FAILED=0

for arg in "$@"; do
  [ "$arg" = "--verbose" ] && VERBOSE=1
done

note() { [ "$VERBOSE" = "1" ] && echo "  $*" || true; }
fail() { echo "FAIL [$CHECK] $*" >&2; FAILED=1; }
pass() { echo "ok   [$CHECK]"; }

authored_files() {
  find "$REPO_DIR" \
    -path "$REPO_DIR/.git" -prune -o \
    -path "$REPO_DIR/node_modules" -prune -o \
    -type f \( -name '*.md' -o -name '*.mdx' -o -name '*.sh' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' -o -name '*.js' -o -name '*.toml' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \) -print
}

check_unicode_clean() {
  CHECK=unicode-clean
  # perl, not grep -P: BSD grep on stock macOS has no -P and would silently
  # skip the scan. The rule is stricter than the ban list: authored files are
  # pure ASCII, so any byte above 0x7F fails.
  command -v perl >/dev/null 2>&1 || { fail "perl not found; cannot scan"; return; }
  bad=0
  for f in $(authored_files); do
    hits=$(perl -ne 'print "$.:$_" if /[^\x00-\x7F]/' "$f" 2>/dev/null | head -5)
    if [ -n "$hits" ]; then
      fail "non-ASCII character in ${f#$REPO_DIR/}:"
      printf '%s\n' "$hits" >&2
      bad=1
    fi
  done
  [ "$bad" = "0" ] && pass
}

check_frontmatter_version() {
  CHECK=frontmatter-version
  fm=$(awk -F'"' '/^  version:/ { print $2; exit }' "$SKILL_DIR/SKILL.md")
  ch=$(grep -m1 '^## \[' "$REPO_DIR/CHANGELOG.md" | sed 's/^## \[\([^]]*\)\].*/\1/')
  body=$(grep -m1 '^## Skill version:' "$SKILL_DIR/SKILL.md" | sed 's/^## Skill version: //')
  pkg=$(node -p "require('$REPO_DIR/package.json').version")
  plugin=$(node -p "require('$REPO_DIR/plugins/godaudits/.claude-plugin/plugin.json').version")
  market=$(node -p "require('$REPO_DIR/.claude-plugin/marketplace.json').metadata.version")
  if [ "$fm" != "$ch" ]; then fail "SKILL.md version ($fm) != CHANGELOG top entry ($ch)"; fi
  if [ "$fm" != "$body" ]; then fail "SKILL.md frontmatter version ($fm) != body Skill version line ($body)"; fi
  if [ "$fm" != "$pkg" ]; then fail "SKILL.md version ($fm) != package.json ($pkg)"; fi
  if [ "$fm" != "$plugin" ]; then fail "SKILL.md version ($fm) != plugin.json ($plugin)"; fi
  if [ "$fm" != "$market" ]; then fail "SKILL.md version ($fm) != marketplace.json ($market)"; fi
  [ "$fm" = "$ch" ] && [ "$fm" = "$body" ] && [ "$fm" = "$pkg" ] && [ "$fm" = "$plugin" ] && [ "$fm" = "$market" ] && pass
}

check_description_length() {
  CHECK=description-length
  desc=$(awk '/^description:/ {print; exit}' "$SKILL_DIR/SKILL.md" | sed 's/^description: //; s/^"//; s/"$//')
  len=$(printf '%s' "$desc" | wc -c | tr -d ' ')
  if [ "$len" -lt 1 ] || [ "$len" -gt 1024 ]; then
    fail "description is $len chars; Agent Skills spec bound is 1-1024"
  else
    note "description length: $len"
    pass
  fi
}

check_dir_name_match() {
  CHECK=dir-name-match
  fm_name=$(awk '/^name:/ {print $2; exit}' "$SKILL_DIR/SKILL.md")
  dir_name=$(basename "$SKILL_DIR")
  if [ "$fm_name" != "$dir_name" ]; then
    fail "frontmatter name ($fm_name) != directory name ($dir_name)"
  else
    pass
  fi
}

check_references_exist() {
  CHECK=references-exist
  bad=0
  for ref in $(grep -o 'references/[a-z-]*\.md' "$SKILL_DIR/SKILL.md" | sort -u); do
    if [ ! -f "$SKILL_DIR/$ref" ]; then
      fail "SKILL.md names $ref but it does not exist"
      bad=1
    else
      note "$ref exists"
    fi
  done
  [ "$bad" = "0" ] && pass
}

check_modules_complete() {
  CHECK=modules-complete
  bad=0
  for f in "$SKILL_DIR"/references/*.md; do
    base=$(basename "$f")
    case "$base" in
      audit-format.md|intake.md|compliance.md|exemplar.md) continue ;;
    esac
    for section in "## Lineage" "## Surface map" "## Checks" "## Scoring" "## Remediation seeds" "## Anti-patterns hunted"; do
      if ! grep -q "^$section" "$f"; then
        fail "$base missing section: $section"
        bad=1
      fi
    done
  done
  [ "$bad" = "0" ] && pass
}

check_symlinks_valid() {
  CHECK=symlinks-valid
  bad=0
  for link in "$REPO_DIR/.agents/skills/godaudits" "$REPO_DIR/.claude/skills/godaudits"; do
    if [ ! -e "$link" ]; then
      fail "projection $link does not resolve"
      bad=1
    fi
  done
  [ "$bad" = "0" ] && pass
}

check_prompt_fresh() {
  CHECK=prompt-fresh
  if bash "$SCRIPT_DIR/build-prompt.sh" --check >/dev/null; then pass; else fail "portable prompts are stale; run npm run build:prompt"; fi
}

check_catalog_fresh() {
  CHECK=catalog-fresh
  if node "$SCRIPT_DIR/build-catalog.js" --check >/dev/null; then pass; else fail "check catalog is stale; run npm run catalog"; fi
}

check_schemas_valid() {
  CHECK=schemas-valid
  if node -e 'const fs=require("fs"),path=require("path"); const roots=process.argv.slice(1); for(const root of roots){for(const file of fs.readdirSync(root)){if(file.endsWith(".json")) JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));}}' "$SKILL_DIR/schemas" "$SKILL_DIR/catalog"; then pass; else fail "schema or catalog JSON did not parse"; fi
}

check_runtime_tests() {
  CHECK=runtime-tests
  if node --test "$REPO_DIR"/test/*.test.js >/dev/null; then pass; else fail "runtime regression tests failed"; fi
}

check_benchmark() {
  CHECK=benchmark
  if node "$REPO_DIR/bin/godaudits.js" benchmark >/dev/null; then pass; else fail "benchmark corpus failed"; fi
}

TARGET="${1:---all}"
case "$TARGET" in
  --all|--verbose)
    check_unicode_clean
    check_frontmatter_version
    check_description_length
    check_dir_name_match
    check_references_exist
    check_modules_complete
    check_symlinks_valid
    check_catalog_fresh
    check_schemas_valid
    check_runtime_tests
    check_benchmark
    check_prompt_fresh
    ;;
  unicode-clean) check_unicode_clean ;;
  frontmatter-version) check_frontmatter_version ;;
  description-length) check_description_length ;;
  dir-name-match) check_dir_name_match ;;
  references-exist) check_references_exist ;;
  modules-complete) check_modules_complete ;;
  symlinks-valid) check_symlinks_valid ;;
  catalog-fresh) check_catalog_fresh ;;
  schemas-valid) check_schemas_valid ;;
  runtime-tests) check_runtime_tests ;;
  benchmark) check_benchmark ;;
  prompt-fresh) check_prompt_fresh ;;
  *) echo "Unknown check: $TARGET" >&2; exit 1 ;;
esac

exit "$FAILED"
