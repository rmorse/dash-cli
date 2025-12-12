# projects-cli

Interactive CLI to quickly navigate to projects in `D:\projects`.

## Features

- Lists all projects in `D:\projects`
- Shows recently used projects at the top (last 5)
- Arrow key navigation with Enter to select
- Color-coded: recent projects in blue, selected in gold
- Works with Bash and PowerShell

## Quick Start

```bash
# Install globally
npm install -g .

# Setup your shell (auto-detects bash or powershell)
projects-cli --setup

# Restart your terminal, then:
projects
```

## Installation

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
cd D:\projects\cli-explorer
npm install
npm run build
npm link
```

### Shell Setup

Run the setup command to automatically configure your shell:

```bash
# Auto-detect shell
projects-cli --setup

# Or specify explicitly
projects-cli --setup bash
projects-cli --setup powershell
```

Then restart your terminal or reload your shell config.

### Manual Setup

If you prefer manual setup:

**Git Bash** - Add to `~/.bashrc`:
```bash
projects() {
    projects-cli
    local selected
    selected=$(cat ~/.projects-cli/last-selection 2>/dev/null)
    if [ -n "$selected" ] && [ -d "$selected" ]; then
        cd "$selected" || return 1
    fi
}
```

**PowerShell** - Add to `$PROFILE`:
```powershell
function projects {
    projects-cli
    $selectionFile = "$env:USERPROFILE\.projects-cli\last-selection"
    if (Test-Path $selectionFile) {
        $selected = Get-Content $selectionFile -Raw
        if ($selected -and (Test-Path $selected.Trim())) {
            Set-Location $selected.Trim()
        }
    }
}
```

## Usage

```bash
projects
```

### Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate |
| `Enter` | Select project |
| `q` / `Esc` | Quit |

## Development

```bash
# Watch mode (rebuilds on changes)
npm run dev

# Manual build
npm run build

# Run directly
node dist/index.js
```

## Project Structure

```
cli-explorer/
├── src/
│   ├── index.tsx         # Entry point
│   ├── scanner.ts        # Scans D:\projects for folders
│   ├── history.ts        # Recent projects + selection file
│   ├── setup.ts          # Shell setup command
│   ├── types.ts          # TypeScript types
│   └── components/
│       └── App.tsx       # ink (React) UI component
├── shell/
│   ├── projects.sh       # Bash wrapper (reference)
│   └── projects.ps1      # PowerShell wrapper (reference)
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## How It Works

1. `projects-cli` scans `D:\projects` for directories
2. Displays an interactive list with recent projects first
3. On selection, writes path to `~/.projects-cli/last-selection`
4. The shell wrapper reads this file and runs `cd`

## Configuration

Data stored in `~/.projects-cli/`:
- `history.json` - Recent projects list
- `last-selection` - Last selected path (for shell wrapper)
