# Dash CLI

A speedy little project switcher for your terminal.

## Features

- Scans for git repositories (configurable depth)
- **Instant startup** - cached results load immediately, background refresh
- Type-to-filter search
- **Favorites** - mark frequently used projects with Ctrl+F, jump to them by number
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

## Favorite Shortcuts

Jump directly to a favorite without opening the UI:

```bash
dash 1      # Go to your first favorite
dash 2      # Go to your second favorite
d 1         # Same thing, using the 'd' alias
```

Favorites are numbered in the order you add them - your first favorite stays `#1`. The shortcut number is displayed next to each favorite in the UI.

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
| `skipDirs` | `node_modules,.git,...` | Comma-separated patterns to skip (supports globs like `*.test`) |
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

## Configuration Files

Stored in `~/.dash-cli/`:
- `settings.json` - User settings
- `favorites.json` - Favorite projects
- `history.json` - Recent projects
- `cache.json` - Cached project scan (for instant startup)
- `last-selection` - Last selected path (for shell wrapper)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Manual build
```
