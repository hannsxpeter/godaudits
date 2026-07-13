#!/usr/bin/env sh
# Install the godaudits skill into AI coding tool skill directories.
#
# Usage:
#   ./install.sh                       install globally for every detected tool
#   ./install.sh --project [dir]       install into a project (default: cwd)
#   ./install.sh --tools claude,agents limit targets (agents,claude,factory,cline,windsurf,copilot-cloud)
#   ./install.sh --copy                copy instead of symlink (Windows, some CI)
#   ./install.sh --uninstall           remove exactly what this script created
#
# Destinations exploit skill-path convergence, so few targets cover many tools:
#   agents         ~/.agents/skills  or  <project>/.agents/skills
#                  (Codex, Cursor, Zed, VS Code/Copilot, Gemini CLI, OpenCode,
#                   Amp, Windsurf, Kilo, Goose, and most Agent Skills adopters)
#   claude         ~/.claude/skills  or  <project>/.claude/skills
#                  (Claude Code; also read by Cursor, OpenCode, Amp, Windsurf,
#                   Copilot, Cline as compatibility paths)
#   factory        ~/.factory/skills          (Factory Droid, global only)
#   cline          ~/.cline/skills            (Cline, global only)
#   windsurf       ~/.codeium/windsurf/skills (Windsurf native global)
#   copilot-cloud  <project>/.github/skills   (Copilot coding agent, project only)
#
# Tools with no skill support (T3 Chat, Aider, plain chat UIs) use PROMPT.md;
# instructions are printed at the end.

set -eu

unset CDPATH
SRC_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
SKILL_SRC="$SRC_DIR/skills/godaudits"
SKILL_NAME="godaudits"
VERSION=$(awk -F'"' '/^  version:/ { print $2; exit }' "$SKILL_SRC/SKILL.md")

MODE="global"
PROJECT_DIR=""
TOOLS="all"
LINK_MODE="symlink"
ACTION="install"
PLACED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      MODE="project"
      if [ $# -gt 1 ] && [ "${2#--}" = "$2" ]; then PROJECT_DIR="$2"; shift; else PROJECT_DIR="$PWD"; fi
      ;;
    --global) MODE="global" ;;
    --tools)
      [ $# -gt 1 ] || { echo "--tools needs a comma-separated list" >&2; exit 1; }
      TOOLS="$2"; shift
      ;;
    --copy) LINK_MODE="copy" ;;
    --uninstall) ACTION="uninstall" ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown flag: $1 (try --help)" >&2; exit 1 ;;
  esac
  shift
done

if [ "$TOOLS" != "all" ]; then
  old_ifs=$IFS
  IFS=,
  for tool in $TOOLS; do
    case "$tool" in
      agents|claude|factory|cline|windsurf|copilot-cloud) ;;
      *) echo "Unknown tool: $tool (try --help)" >&2; exit 1 ;;
    esac
  done
  IFS=$old_ifs
fi
if [ "$MODE" = "global" ] && [ "$TOOLS" != "all" ]; then
  case ",$TOOLS," in
    *,copilot-cloud,*) echo "copilot-cloud requires --project" >&2; exit 1 ;;
  esac
fi

wants() {
  [ "$TOOLS" = "all" ] && return 0
  case ",$TOOLS," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

place() {
  label=$1
  dest_root=$2
  dest="$dest_root/$SKILL_NAME"
  if [ -L "$dest" ] || [ -e "$dest" ]; then
    if [ ! -f "$dest/INSTALLER-MANAGED" ] || ! grep -qx 'godaudits install.sh managed destination' "$dest/INSTALLER-MANAGED"; then
      echo "Refusing to replace or remove unowned destination: $dest" >&2
      echo "Move it aside manually, then run the installer again." >&2
      return 1
    fi
  fi
  if [ "$ACTION" = "uninstall" ]; then
    if [ -L "$dest" ] || [ -e "$dest" ]; then
      rm -rf "$dest"
      echo "Removed $dest ($label)"
    fi
    return 0
  fi
  mkdir -p "$dest_root"
  rm -rf "$dest"
  if [ "$LINK_MODE" = "symlink" ] && ln -s "$SKILL_SRC" "$dest" 2>/dev/null; then
    echo "Linked  $dest -> $SKILL_SRC ($label)"
  else
    cp -R "$SKILL_SRC" "$dest"
    echo "Copied  $SKILL_SRC -> $dest ($label)"
  fi
  PLACED=$((PLACED + 1))
}

if [ "$MODE" = "project" ]; then
  [ -d "$PROJECT_DIR" ] || { echo "No such project dir: $PROJECT_DIR" >&2; exit 1; }
  wants agents        && place "Agent Skills convention" "$PROJECT_DIR/.agents/skills"
  wants claude        && place "Claude Code"             "$PROJECT_DIR/.claude/skills"
  wants copilot-cloud && place "Copilot coding agent"    "$PROJECT_DIR/.github/skills"
else
  wants agents   && place "Agent Skills convention" "${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"
  wants claude   && place "Claude Code"             "${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
  wants factory  && [ -d "$HOME/.factory" ] && place "Factory Droid" "$HOME/.factory/skills"
  wants cline    && [ -d "$HOME/.cline" ]   && place "Cline"         "$HOME/.cline/skills"
  wants windsurf && [ -d "$HOME/.codeium" ] && place "Windsurf"      "$HOME/.codeium/windsurf/skills"
fi

if [ "$ACTION" = "install" ] && [ -x "$SRC_DIR/scripts/build-prompt.sh" ]; then
  if ! "$SRC_DIR/scripts/build-prompt.sh" --check >/dev/null 2>&1; then
    echo "Warning: generated portable prompts are stale; run npm run build:prompt." >&2
  fi
fi

if [ "$ACTION" = "install" ]; then
  if [ "$PLACED" -eq 0 ]; then
    echo "No matching tool destinations were available." >&2
    exit 1
  fi
  cat <<EOF

godaudits v$VERSION installed.

Invoke: /godaudits (Claude Code, Cursor, VS Code, Zed, Factory)
        \$godaudits (Codex)   @godaudits (Windsurf)   auto-trigger elsewhere

Alternative install: npx skills add hannsxpeter/godaudits

No-skill-support tools:
  T3 Chat: use PROMPT.md for focused audits or attach PROMPT.full.md for all domains.
  Aider:   aider --read PROMPT.full.md
  Any chat UI: attach PROMPT.full.md when the context window permits it.
EOF
fi
