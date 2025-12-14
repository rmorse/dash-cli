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

Access the full shortcuts editor from **Settings > Edit shortcuts** to:

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

Press `Ctrl+T` on any project to quickly add it as a shortcut. This creates a shortcut with:
- Name: the project path
- Trigger: next available number (1, 2, 3...)
- Command: `cd "/path/to/project"`

Edit the shortcut later to customize the trigger or add more commands.

## Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list |
| `Enter` | Select project |
| `→` / `←` | Drill into / back from nested projects |
| `PgUp` / `PgDn` | Page navigation |
| Type | Filter projects |
| `Ctrl+T` | Toggle shortcut (customizable) |
| `Ctrl+R` | Refresh projects list (customizable) |
| `Esc` | Clear filter / go back / quit |
| `Tab` | Open settings |

## Settings

Press `Tab` to open the settings screen, or edit `~/.dash-cli/settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `projectsDir` | `D:\projects` | Root directory to scan |
| `maxDepth` | `4` | How deep to scan for nested repos |
| `skipDirs` | `node_modules,...` | Comma-separated patterns to skip (supports globs like `*.test`) |
| `recentCount` | `5` | Number of recent projects to show |
| `visibleRows` | `12` | Viewport height |
| `selectedColor` | `#FFD700` | Highlight color for selected item |
| `shortcutColor` | `#69FFBE` | Color for shortcut items |
| `recentColor` | `#6495ED` | Color for recent items |
| `shortcutToggleKey` | `t` | Key for Ctrl+? to toggle shortcut |
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
