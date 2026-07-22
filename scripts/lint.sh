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
#   catalog-fresh        the generated machine catalog is current.
#   catalog-claims       every prose claim of "N checks" or "N domains" agrees
#                        with the generated catalog.
#   schemas-valid        every committed JSON and schema document parses.
#   runtime-tests        compiler, renderer, evidence, eval, and interop tests pass.
#   benchmark            the deterministic multi-language corpus passes.
#   eval-suite           the deterministic product evaluations pass.
#   prompt-fresh         both portable prompts match build-prompt.sh output.
#   shell-syntax         every authored shell script parses.
#   actions-pinned       every GitHub Action uses an immutable commit SHA.
#   skill-size-budget    SKILL.md stays below progressive-disclosure limits.
#   official-validator  runs the official validator when its binary is available.
#   tag-release-parity  package version, git tag, and GitHub release agree.
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
    -type d \( -name .git -o -name node_modules -o -name '.venv-*' \) -prune -o \
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

check_catalog_claims() {
  CHECK=catalog-claims
  # Counts stated in prose drift silently. The freshness gates cannot catch it:
  # prompt-fresh compares the generated prompts against their generator, so a
  # literal typed into the generator stays self-consistent while contradicting
  # the catalog. This scans the claim itself against catalog/checks.json.
  #
  # Scope is every tracked authored file except CHANGELOG.md (a released entry
  # records the count that was true then), codeaudit.md (dated audit output),
  # and benchmarks/fixtures (seeded repositories standing in for other
  # projects, whose prose is not a godaudits claim).
  #
  # Check claims require three or more digits so the per-domain counts in
  # docs/CHECK-MAP.md are not swept in. Domain claims exclude "domain score",
  # which is a 0-100 scale rather than a count.
  out=$(node -e '
const fs = require("fs");
const cp = require("child_process");
const repo = process.argv[1];
const cat = JSON.parse(fs.readFileSync(repo + "/skills/godaudits/catalog/checks.json", "utf8"));
const skip = /^(CHANGELOG\.md|codeaudit\.md)$|^benchmarks\/fixtures\//;
const files = cp.execSync("git ls-files", { cwd: repo }).toString().split("\n")
  .filter((f) => /\.(md|mdx|json|js|sh|yml|yaml)$/.test(f))
  .filter((f) => !skip.test(f));
const CHECKS = /(\d{3,})[- ]+(?:versioned |unique )?checks?\b/g;
const DOMAINS = /(\d+)[- ]+domains?\b(?! score)/g;
const bad = [];
for (const f of files) {
  let text;
  try { text = fs.readFileSync(repo + "/" + f, "utf8"); } catch (e) { continue; }
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(CHECKS)) {
      if (Number(m[1]) !== cat.check_count) bad.push(f + ":" + (i + 1) + " claims " + m[1] + " checks; catalog has " + cat.check_count);
    }
    for (const m of line.matchAll(DOMAINS)) {
      if (Number(m[1]) !== cat.domain_count) bad.push(f + ":" + (i + 1) + " claims " + m[1] + " domains; catalog has " + cat.domain_count);
    }
  });
}
if (bad.length) console.log(bad.join("\n"));
' "$REPO_DIR") || { fail "claim scan did not run"; return; }
  if [ -n "$out" ]; then
    fail "count claims disagree with catalog/checks.json:"
    printf '%s\n' "$out" >&2
  else
    note "claims agree with the catalog"
    pass
  fi
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

check_eval_suite() {
  CHECK=eval-suite
  if node "$SCRIPT_DIR/eval.js" >/dev/null; then pass; else fail "deterministic evaluations failed"; fi
}

check_shell_syntax() {
  CHECK=shell-syntax
  if bash -n "$REPO_DIR"/scripts/*.sh "$REPO_DIR/install.sh"; then pass; else fail "a shell script has invalid syntax"; fi
}

check_actions_pinned() {
  CHECK=actions-pinned
  bad=$(awk '/^[[:space:]]*uses:/ && $0 !~ /@[0-9a-f]{40}([[:space:]]|$)/ { print FNR ":" $0 }' "$REPO_DIR"/.github/workflows/*.yml "$REPO_DIR"/.github/workflows/*.yaml 2>/dev/null || true)
  if [ -n "$bad" ]; then fail "workflow actions must use immutable 40-character SHAs:\n$bad"; else pass; fi
}

check_skill_size_budget() {
  CHECK=skill-size-budget
  lines=$(wc -l < "$SKILL_DIR/SKILL.md" | tr -d ' ')
  words=$(wc -w < "$SKILL_DIR/SKILL.md" | tr -d ' ')
  if [ "$lines" -gt 500 ] || [ "$words" -gt 5000 ]; then
    fail "SKILL.md is $lines lines and $words words; limits are 500 lines and 5000 words"
  else
    note "SKILL.md is $lines lines and $words words"
    pass
  fi
}

check_official_validator() {
  CHECK=official-validator
  validator="${SKILLS_REF_BIN:-}"
  if [ -z "$validator" ] && command -v skills-ref >/dev/null 2>&1; then validator="$(command -v skills-ref)"; fi
  if [ -z "$validator" ]; then
    note "skills-ref is not installed; scripts/release-check.sh requires it"
    pass
  elif "$validator" validate "$SKILL_DIR" >/dev/null; then
    pass
  else
    fail "official Agent Skills validation failed"
  fi
}

check_tag_release_parity() {
  CHECK=tag-release-parity
  version=$(node -p "require('$REPO_DIR/package.json').version")
  tag="v$version"
  if ! git -C "$REPO_DIR" rev-parse "$tag^{commit}" >/dev/null 2>&1; then fail "missing git tag $tag"; return; fi
  if ! command -v gh >/dev/null 2>&1; then fail "gh is required"; return; fi
  if ! gh release view "$tag" --repo hannsxpeter/godaudits --json tagName,isDraft,isPrerelease --jq '.tagName + " " + (.isDraft|tostring) + " " + (.isPrerelease|tostring)' 2>/dev/null | grep -q "^$tag false false$"; then
    fail "GitHub release $tag is missing, draft, or prerelease"
    return
  fi
  pass
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
    check_catalog_claims
    check_schemas_valid
    check_runtime_tests
    check_benchmark
    check_eval_suite
    check_prompt_fresh
    check_shell_syntax
    check_actions_pinned
    check_skill_size_budget
    check_official_validator
    ;;
  unicode-clean) check_unicode_clean ;;
  frontmatter-version) check_frontmatter_version ;;
  description-length) check_description_length ;;
  dir-name-match) check_dir_name_match ;;
  references-exist) check_references_exist ;;
  modules-complete) check_modules_complete ;;
  symlinks-valid) check_symlinks_valid ;;
  catalog-fresh) check_catalog_fresh ;;
  catalog-claims) check_catalog_claims ;;
  schemas-valid) check_schemas_valid ;;
  runtime-tests) check_runtime_tests ;;
  benchmark) check_benchmark ;;
  eval-suite) check_eval_suite ;;
  prompt-fresh) check_prompt_fresh ;;
  shell-syntax) check_shell_syntax ;;
  actions-pinned) check_actions_pinned ;;
  skill-size-budget) check_skill_size_budget ;;
  official-validator) check_official_validator ;;
  tag-release-parity) check_tag_release_parity ;;
  *) echo "Unknown check: $TARGET" >&2; exit 1 ;;
esac

exit "$FAILED"
