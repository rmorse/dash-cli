# Dash CLI

A speedy little project switcher for your terminal.

## Features

- Scans for git repositories (configurable depth)
- **Instant startup** - cached results load immediately, background refresh
- Type-to-filter search
- **Shortcuts** - custom triggers, multi-line commands, chainable
- Recent projects shown at top
- Nested project drill-down navigation
- Configurable via settings screen
- Works with Bash and PowerShell

## Quick Start

```bash
npm install -g .
dash-cli --setup
# Restart terminal, then:
dash
```

## Shortcuts

### Quick Access

Jump directly to a shortcut by its trigger:

```bash
dash myproj     # Run shortcut with trigger "myproj"
dash 1          # Run shortcut with trigger "1"
d work          # Same thing, using the 'd' alias
```

### Chaining Shortcuts

Chain multiple shortcuts together - commands run in sequence:

```bash
dash 1 claude       # cd to project, then run claude
dash work code      # cd to work project, then open VS Code
dash proj test run  # Chain three shortcuts together
```

If any trigger in the chain doesn't exist, you'll get an error.

### Shortcuts Editor

Access the full shortcuts editor from the **Shortcuts** tab (`Tab` from Projects) to:

- **Custom triggers** - Use any text (e.g., `work`, `api`, `1`)
- **Multi-line commands** - Run multiple commands in sequence
- **Case sensitivity** - Toggle per-shortcut (default: case-insensitive)

Example shortcut:
```
Name:           My Project
Trigger:        proj
Case Sensitive: No
Commands:
  cd ~/projects/my-project
  code .
  npm run dev
```

### Quick Add

Press `Ctrl+T` on any project or recent item to quickly add it as a shortcut. This creates a shortcut with:
- Name: the project path
- Trigger: next available number (1, 2, 3...)
- Command: `cd "/path/to/project"`

To delete a shortcut, select it in the Shortcuts section and press `Ctrl+D` (confirm with y/n).

Edit shortcuts via the **Shortcuts** tab (`Tab` from Projects) to customize triggers or add more commands.

## Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list |
| `Enter` | Select project |
| `→` / `←` | Drill into / back from nested projects |
| `PgUp` / `PgDn` | Page navigation |
| Type | Filter projects |
| `Ctrl+T` | Add shortcut (customizable) |
| `Ctrl+D` | Delete shortcut (in Shortcuts section) |
| `Ctrl+R` | Refresh projects list (customizable) |
| `Tab` | Cycle tabs (Projects → Shortcuts → Settings) |
| `Esc` | Clear filter / go back / save & exit / quit |

## Tabs

The app has three tabs, accessible by pressing `Tab`:

1. **Projects** - Main project list with shortcuts and recent projects
2. **Shortcuts** - Edit, add, and delete shortcuts
3. **Settings** - Configure app settings

## Settings

Press `Tab` twice from Projects to reach settings, or edit `~/.dash-cli/settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `projectsDir` | `D:\projects` | Root directory to scan |
| `maxDepth` | `4` | How deep to scan for nested repos |
| `skipDirs` | `node_modules,...` | Comma-separated patterns to skip (supports globs like `*.test`) |
| `showShortcuts` | `true` | Show shortcuts section in the main list |
| `showRecent` | `true` | Show recent projects section in the main list |
| `recentCount` | `5` | Number of recent projects to show (only visible when `showRecent` is true) |
| `visibleRows` | `12` | Viewport height |
| `selectedColor` | `#FFD700` | Highlight color for selected item |
| `shortcutColor` | `#69FFBE` | Color for shortcut items |
| `recentColor` | `#6495ED` | Color for recent items |
| `shortcutToggleKey` | `t` | Key for Ctrl+? to add shortcut |
| `refreshKey` | `r` | Key for Ctrl+? to refresh projects |

## Installation

### Prerequisites
- Node.js 18+

### Install
```bash
cd D:\projects\cli-explorer
npm install
npm run build
npm link
```

### Shell Setup
```bash
dash-cli --setup                    # Auto-detect shell
dash-cli --setup bash               # Git Bash
dash-cli --setup powershell         # PowerShell
dash-cli --setup --alias            # Add 'd' shortcut
dash-cli --setup bash --alias       # Bash with 'd' shortcut
```

## CLI Options

```bash
dash-cli --setup [shell] [--alias]  # Configure shell integration
dash-cli --debug                     # Enable debug logging
dash proj                            # Run shortcut "proj"
dash 1 claude                        # Chain shortcuts together
```

| Flag | Description |
|------|-------------|
| `--setup` | Configure shell integration (bash/powershell) |
| `--alias` | Add 'd' shortcut during setup |
| `--debug` | Enable debug logging to `~/.dash-cli/debug.log` |
| `[triggers...]` | Run one or more shortcuts by trigger |

## CLI Shortcut Management

Manage shortcuts from the command line using `dash-cli -- <command>`. The `--` separator distinguishes CLI commands from trigger execution.

### Commands

#### `add` - Add a new shortcut

```bash
dash-cli -- add <trigger> <command...> [--name "Name"] [--case-sensitive]
```

| Argument/Flag | Required | Description |
|---------------|----------|-------------|
| `<trigger>` | Yes | Unique trigger text (cannot contain spaces or start with `--`) |
| `<command...>` | Yes | One or more commands to run |
| `--name "Name"` | No | Display name (defaults to trigger) |
| `--case-sensitive` | No | Make trigger case-sensitive (default: case-insensitive) |
| `--json` | No | Output in JSON format |

```bash
# Basic usage (name auto-set to trigger)
dash-cli -- add proj "cd /projects/myproj"

# Multiple commands
dash-cli -- add proj "cd /projects/myproj" "code ."

# With custom name
dash-cli -- add proj "cd /projects/myproj" --name "My Project"

# Case-sensitive trigger
dash-cli -- add Proj "cd /projects/myproj" --case-sensitive
```

#### `list` - List all shortcuts

```bash
dash-cli -- list [--json]
```

| Flag | Description |
|------|-------------|
| `--json` | Output full shortcut data as JSON |

```bash
# Human-readable table
dash-cli -- list

# JSON output
dash-cli -- list --json
```

Output example:
```
Shortcuts:
  proj    My Project    cd /projects/myproj, code .
  web     Website       cd /sites/web
```

#### `show` - Show shortcut details

```bash
dash-cli -- show <trigger> [--json]
```

| Argument/Flag | Required | Description |
|---------------|----------|-------------|
| `<trigger>` | Yes | Trigger to look up |
| `--json` | No | Output as JSON |

```bash
dash-cli -- show proj
```

Output example:
```
  Trigger:  proj
  Name:     My Project
  Case:     insensitive
  Commands:
    cd /projects/myproj
    code .
```

#### `edit` - Edit an existing shortcut

```bash
dash-cli -- edit <trigger> [--name "Name"] [--trigger new] [--command "cmd"] [--case-sensitive] [--json]
```

| Argument/Flag | Required | Description |
|---------------|----------|-------------|
| `<trigger>` | Yes | Current trigger of shortcut to edit |
| `--name "Name"` | No | New display name |
| `--trigger new` | No | New trigger (must be unique) |
| `--command "cmd"` | No | Replace commands (comma-separated for multiple) |
| `--case-sensitive` | No | Set case-sensitive (flag present = true) |
| `--json` | No | Output as JSON |

```bash
# Change name
dash-cli -- edit proj --name "My Awesome Project"

# Change trigger
dash-cli -- edit proj --trigger myproj

# Replace commands
dash-cli -- edit proj --command "cd /new/path"

# Multiple commands (comma-separated)
dash-cli -- edit proj --command "cd /path,code ."

# Make case-sensitive
dash-cli -- edit proj --case-sensitive

# Multiple changes at once
dash-cli -- edit proj --name "New Name" --trigger newproj --case-sensitive
```

#### `rm` - Remove a shortcut

```bash
dash-cli -- rm <trigger> [--json]
```

| Argument/Flag | Required | Description |
|---------------|----------|-------------|
| `<trigger>` | Yes | Trigger of shortcut to remove |
| `--json` | No | Output as JSON |

```bash
dash-cli -- rm proj
```

#### `help` - Show usage

```bash
dash-cli -- help
dash-cli --        # Also shows help when no command given
```

### JSON Output

All commands support `--json` for machine-readable output:

```bash
# Success responses
dash-cli -- add proj "cd /foo" --json
# {"success":true,"message":"Added: proj","shortcut":{...}}

dash-cli -- list --json
# {"shortcuts":[...]}

dash-cli -- show proj --json
# {"shortcut":{...}}

dash-cli -- edit proj --name "New" --json
# {"success":true,"shortcut":{...}}

dash-cli -- rm proj --json
# {"deleted":true,"trigger":"proj"}

# Error responses
dash-cli -- show nonexistent --json
# {"error":"Shortcut not found: nonexistent"}
```

### Error Handling

Commands exit with code 1 on errors:

```bash
# Missing arguments
dash-cli -- add
# Error: Usage: dash -- add <trigger> <command...> [--name "Name"] [--case-sensitive]

# Trigger collision
dash-cli -- add existingTrigger "cmd"
# Error: Trigger "existingTrigger" collides with "existingTrigger" (case-insensitive) on "Existing Name"

# Not found
dash-cli -- show nonexistent
# Error: Shortcut not found: nonexistent

# Invalid trigger
dash-cli -- add "my trigger" "cmd"
# Error: Trigger cannot contain spaces
```

## Configuration Files

Stored in `~/.dash-cli/`:
- `settings.json` - User settings
- `shortcuts.json` - Shortcuts with triggers and commands
- `history.json` - Recent projects
- `cache.json` - Cached project scan (for instant startup)
- `last-command` - Commands to execute (sourced by shell wrapper)
- `debug.log` - Debug log (when running with `--debug`)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Manual build
```
