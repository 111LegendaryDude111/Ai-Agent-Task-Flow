#!/usr/bin/env bash
#############################################################################
# Task Management Skill Router
# Routes to task-cli.ts with proper path resolution and command handling
#############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/scripts/task-cli.ts"

# Show help
show_help() {
  cat << 'HELP'
📋 Task Management Skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: router.sh [COMMAND] [OPTIONS]

COMMANDS:
  status [feature]              Show task status summary
  next [feature]                Show next eligible tasks
  parallel [feature]            Show parallelizable tasks
  deps <feature> <seq>          Show dependency tree
  blocked [feature]             Show blocked tasks
  start <feature> <seq>         Mark a ready subtask in progress
  gate <feature> <seq> <gate>   Record required AutoFlow gate evidence
  transition <feature> <state>  Validate and store AutoFlow state
  block <feature> [seq] "reason" Mark feature/subtask blocked
  unblock <feature> [seq]       Reopen blocked feature/subtask
  reopen <feature> <seq>        Reopen completed/cancelled subtask
  cancel <feature> [seq]        Cancel feature/subtask
  verify <feature> <seq>        Run verification gate and save evidence
  verify-feature <feature>      Run feature verification and save evidence
  complete <feature> <seq> "msg" Mark subtask complete after verification
  archive <feature>             Archive feature after feature verification
  validate [feature]            Validate JSON files
  help                          Show this help message

EXAMPLES:
  ./router.sh status
  ./router.sh status my-feature
  ./router.sh next
  ./router.sh deps my-feature 05
  ./router.sh start my-feature 05 CoderAgent
  ./router.sh gate my-feature 05 red "expected failure confirmed"
  ./router.sh gate my-feature 05 green "targeted tests passed"
  ./router.sh gate my-feature 05 review "no blocking findings"
  ./router.sh verify my-feature 05
  ./router.sh complete my-feature 05 "Implemented auth module"
  ./router.sh verify-feature my-feature
  ./router.sh archive my-feature
  ./router.sh validate

FEATURES:
  ✓ Track progress across all features
  ✓ Find next eligible tasks (dependencies satisfied)
  ✓ Identify blocked tasks
  ✓ Enforce lifecycle commands and AutoFlow gates
  ✓ Separate verification from completion
  ✓ Feature-level verification before archive
  ✓ Validate task integrity

For more info, see: skills/task-management/SKILL.md
HELP
}

# Check if CLI script exists
if [ ! -f "$CLI_SCRIPT" ]; then
    echo "❌ Error: task-cli.ts not found at $CLI_SCRIPT"
    exit 1
fi

# Find project root
find_project_root() {
    local dir
    dir="$(pwd)"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/.git" ] || [ -f "$dir/package.json" ]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    pwd
    return 1
}

# Handle help
if [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# If no arguments, show help
if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

PROJECT_ROOT="$(find_project_root)"
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'

# Run the task CLI with all arguments
cd "$PROJECT_ROOT" && npx --no-install ts-node "$CLI_SCRIPT" "$@"
