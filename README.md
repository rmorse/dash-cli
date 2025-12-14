# Dash CLI

A speedy little project switcher for your terminal.

## Features

- Scans for git repositories (configurable depth)
- **Instant startup** - cached results load immediately, background refresh
- Type-to-filter search
- **Favorites** - custom shortcuts, multi-line commands, chainable
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

## Favorites

### Quick Access

Jump directly to a favorite by its shortcut:

```bash
dash myproj     # Run favorite with shortcut "myproj"
dash 1          # Run favorite with shortcut "1"
d work          # Same thing, using the 'd' alias
```

### Chaining Favorites

Chain multiple favorites together - commands run in sequence:

```bash
dash 1 claude       # cd to project, then run claude
dash work code      # cd to work project, then open VS Code
dash proj test run  # Chain three favorites together
```

If any shortcut in the chain doesn't exist, you'll get an error.

### Favorites Editor

Access the full favorites editor from **Settings > Edit favorites** to:

- **Custom shortcuts** - Use any text (e.g., `work`, `api`, `1`)
- **Multi-line commands** - Run multiple commands in sequence
- **Case sensitivity** - Toggle per-favorite (default: case-insensitive)

Example favorite:
```
Name:           My Project
Shortcut:       proj
Case Sensitive: No
Commands:
  cd ~/projects/my-project
  code .
  npm run dev
```

### Quick Add

Press `Ctrl+F` on any project to quickly add it as a favorite. This creates a favorite with:
- Name: the project path
- Shortcut: next available number (1, 2, 3...)
- Command: `cd "/path/to/project"`

Edit the favorite later to customize the shortcut or add more commands.

## Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list |
| `Enter` | Select project |
| `→` / `←` | Drill into / back from nested projects |
| `PgUp` / `PgDn` | Page navigation |
| Type | Filter projects |
| `Ctrl+F` | Toggle favorite (customizable) |
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
| `favoriteColor` | `#69FFBE` | Color for favorite items |
| `recentColor` | `#6495ED` | Color for recent items |
| `favoriteKey` | `f` | Key for Ctrl+? to toggle favorite |
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
dash proj                            # Run favorite "proj"
dash 1 claude                        # Chain favorites together
```

| Flag | Description |
|------|-------------|
| `--setup` | Configure shell integration (bash/powershell) |
| `--alias` | Add 'd' shortcut during setup |
| `--debug` | Enable debug logging to `~/.dash-cli/debug.log` |
| `[shortcuts...]` | Run one or more favorites by shortcut |

## Configuration Files

Stored in `~/.dash-cli/`:
- `settings.json` - User settings
- `favorites.json` - Favorites with shortcuts and commands
- `history.json` - Recent projects
- `cache.json` - Cached project scan (for instant startup)
- `last-command` - Commands to execute (sourced by shell wrapper)
- `debug.log` - Debug log (when running with `--debug`)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Manual build
```
