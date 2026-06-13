#!/bin/sh
set -eu

HOME_DIR=/tmp/dash-home
PROJECTS_DIR=/tmp/dash-projects
CONFIG_DIR="$HOME_DIR/.dash-cli"
LAST_OUTPUT_FILE=/tmp/dash-cli-last-output.txt

export HOME="$HOME_DIR"
export DASH_CLI_DOCUMENTS_DIR="$HOME_DIR/Documents"

mkdir -p "$HOME_DIR" "$PROJECTS_DIR/app" "$PROJECTS_DIR/api" "$PROJECTS_DIR/tools"
rm -rf "$CONFIG_DIR"

fail() {
  echo "e2e failure: $*" >&2
  if [ -f "$LAST_OUTPUT_FILE" ]; then
    echo "--- last command output ---" >&2
    cat "$LAST_OUTPUT_FILE" >&2
    echo "---------------------------" >&2
  fi
  exit 1
}

pass() {
  echo "ok - $*"
}

run_ok() {
  set +e
  "$@" >"$LAST_OUTPUT_FILE" 2>&1
  status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    fail "expected success for: $*"
  fi
}

run_fail() {
  set +e
  "$@" >"$LAST_OUTPUT_FILE" 2>&1
  status=$?
  set -e
  if [ "$status" -eq 0 ]; then
    fail "expected failure for: $*"
  fi
}

output() {
  cat "$LAST_OUTPUT_FILE"
}

assert_contains() {
  haystack=$1
  needle=$2
  echo "$haystack" | grep -F "$needle" >/dev/null || fail "expected output to contain: $needle"
}

assert_not_contains_file() {
  file=$1
  needle=$2
  if [ -f "$file" ] && grep -F "$needle" "$file" >/dev/null; then
    fail "expected $file not to contain: $needle"
  fi
}

assert_file_contains() {
  file=$1
  needle=$2
  [ -f "$file" ] || fail "expected file to exist: $file"
  grep -F "$needle" "$file" >/dev/null || fail "expected $file to contain: $needle"
}

assert_file_equals() {
  file=$1
  expected_file=$2
  [ -f "$file" ] || fail "expected file to exist: $file"
  cmp -s "$file" "$expected_file" || {
    echo "expected:" >&2
    cat "$expected_file" >&2
    echo "actual:" >&2
    cat "$file" >&2
    fail "file contents differed: $file"
  }
}

assert_json() {
  json=$1
  expression=$2
  node -e '
const data = JSON.parse(process.argv[1]);
if (!Function("data", `return (${process.argv[2]});`)(data)) {
  console.error("JSON assertion failed:", process.argv[2]);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
' "$json" "$expression" || fail "JSON assertion failed: $expression"
}

assert_json_file() {
  file=$1
  expression=$2
  node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!Function("data", `return (${process.argv[2]});`)(data)) {
  console.error("JSON assertion failed:", process.argv[2]);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
' "$file" "$expression" || fail "JSON file assertion failed: $expression"
}

run_ok dash-cli -- help
assert_contains "$(output)" "Usage: dash -- <command>"

run_ok dash-cli --
assert_contains "$(output)" "Commands:"

run_ok dash-cli -- list
assert_contains "$(output)" "No shortcuts configured."
pass "help and empty list commands"

run_ok dash-cli -- add proj "cd $PROJECTS_DIR/app" "npm test" --name "Project App" --json
assert_json "$(output)" 'data.success === true && data.shortcut.trigger === "proj" && data.shortcut.name === "Project App" && data.shortcut.command.length === 2'

run_ok dash-cli -- add test "npm test" --json
assert_json "$(output)" 'data.success === true && data.shortcut.trigger === "test"'

run_ok dash-cli -- list --json
assert_json "$(output)" 'data.shortcuts.length === 2 && data.shortcuts[0].trigger === "proj" && data.shortcuts[1].trigger === "test"'

run_ok dash-cli -- show PROJ --json
assert_json "$(output)" 'data.shortcut.trigger === "proj" && data.shortcut.caseSensitive === false'

run_ok dash-cli -- show proj
assert_contains "$(output)" "Trigger:  proj"
assert_contains "$(output)" "Project App"

run_ok dash-cli -- edit proj --trigger app --name "Case App" --command "cd $PROJECTS_DIR/app,npm run dev" --case-sensitive --json
assert_json "$(output)" 'data.success === true && data.shortcut.trigger === "app" && data.shortcut.caseSensitive === true && data.shortcut.command[1] === "npm run dev"'

run_fail dash-cli -- show APP
assert_contains "$(output)" "Shortcut not found: APP"

run_ok dash-cli -- show app --json
assert_json "$(output)" 'data.shortcut.trigger === "app" && data.shortcut.name === "Case App"'
pass "shortcut CRUD happy paths"

run_fail dash-cli -- unknown
assert_contains "$(output)" "Unknown command: unknown"

run_fail dash-cli -- add
assert_contains "$(output)" "Usage: dash -- add"

run_fail dash-cli -- add "bad trigger" "echo bad"
assert_contains "$(output)" "Trigger cannot contain spaces"

run_fail dash-cli -- add APP "echo duplicate"
assert_contains "$(output)" "collides"

run_fail dash-cli -- edit app
assert_contains "$(output)" "No updates provided"

run_fail dash-cli -- edit app --trigger test
assert_contains "$(output)" "collides"

run_fail dash-cli -- show missing --json
assert_json "$(output)" 'data.error === "Shortcut not found: missing"'

run_fail dash-cli -- rm missing
assert_contains "$(output)" "Shortcut not found: missing"
pass "CLI error paths"

rm -f "$CONFIG_DIR/last-command"
run_ok dash-cli app test
printf "cd %s/app\nnpm run dev\nnpm test" "$PROJECTS_DIR" > /tmp/expected-last-command
assert_file_equals "$CONFIG_DIR/last-command" /tmp/expected-last-command

run_fail dash-cli missing-trigger
assert_contains "$(output)" "Shortcut not found: missing-trigger"
pass "direct trigger execution"

run_ok dash-cli --debug -- list --json
assert_json "$(output)" 'Array.isArray(data.shortcuts)'
assert_file_contains "$CONFIG_DIR/debug.log" "CLI mode detected"
pass "debug logging for CLI route"

run_ok dash-cli -- rm app --json
assert_json "$(output)" 'data.deleted === true && data.trigger === "app"'

run_ok dash-cli -- list --json
assert_json "$(output)" 'data.shortcuts.length === 1 && data.shortcuts[0].trigger === "test"'
pass "remove command"

printf "%s\n" "$PROJECTS_DIR" | dash-cli --setup bash --alias >"$LAST_OUTPUT_FILE" 2>&1
assert_file_contains "$HOME_DIR/.bashrc" "dash-cli"
assert_file_contains "$HOME_DIR/.bashrc" "alias d=dash"
assert_json_file "$CONFIG_DIR/settings.json" 'data.projectsDir === "/tmp/dash-projects"'

run_ok dash-cli --uninstall bash
assert_not_contains_file "$HOME_DIR/.bashrc" "# Dash CLI:"
[ -f "$HOME_DIR/.bashrc.bkp" ] || fail "expected bash profile backup"
pass "bash setup and uninstall"

printf "%s\n" "$PROJECTS_DIR" | dash-cli --setup powershell --alias >"$LAST_OUTPUT_FILE" 2>&1
PS_PROFILE="$HOME_DIR/.config/powershell/Microsoft.PowerShell_profile.ps1"
assert_file_contains "$PS_PROFILE" "function dash"
assert_file_contains "$PS_PROFILE" "Set-Alias -Name d -Value dash"

run_ok dash-cli --uninstall powershell
assert_not_contains_file "$PS_PROFILE" "# Dash CLI:"
pass "powershell profile setup and uninstall"

run_fail dash-cli --uninstall fish
assert_contains "$(output)" "Unknown shell: fish"
pass "setup argument errors"

echo "All Docker e2e checks passed."
