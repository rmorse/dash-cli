# projects-cli

Interactive CLI to quickly navigate to project directories.

## Features

- Scans for git repositories (configurable depth)
- **Instant startup** - cached results load immediately, background refresh
- Type-to-filter search
- Recent projects shown at top
- Nested project drill-down navigation
- Configurable via settings screen
- Works with Bash and PowerShell

## Quick Start

```bash
npm install -g .
projects-cli --setup
# Restart terminal, then:
projects
```

## Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list |
| `Enter` | Select project |
| `→` / `←` | Drill into / back from nested projects |
| `PgUp` / `PgDn` | Page navigation |
| Type | Filter projects |
| `Ctrl+R` | Refresh projects list |
| `Esc` | Clear filter / go back / quit |
| `Tab` | Open settings |

## Settings

Press `Tab` to open the settings screen, or edit `~/.projects-cli/settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `projectsDir` | `D:\projects` | Root directory to scan |
| `maxDepth` | `4` | How deep to scan for nested repos |
| `skipDirs` | `node_modules,.git,...` | Comma-separated patterns to skip (supports globs like `*.test`) |
| `recentCount` | `5` | Number of recent projects to show |
| `visibleRows` | `12` | Viewport height |
| `selectedColor` | `#FFD700` | Highlight color for selected item |
| `recentColor` | `#6495ED` | Color for recent items |

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
projects-cli --setup                    # Auto-detect shell
projects-cli --setup bash               # Git Bash
projects-cli --setup powershell         # PowerShell
projects-cli --setup --alias            # Add 'p' shortcut
projects-cli --setup bash --alias       # Bash with 'p' shortcut
```

## Configuration Files

Stored in `~/.projects-cli/`:
- `settings.json` - User settings
- `history.json` - Recent projects
- `cache.json` - Cached project scan (for instant startup)
- `last-selection` - Last selected path (for shell wrapper)

## Development

```bash
npm run dev    # Watch mode
npm run build  # Manual build
```
