# projects-cli

Interactive CLI to quickly navigate to projects in `D:\projects`.

## Features

- Lists all projects in `D:\projects`
- Shows recently used projects at the top (last 5)
- Arrow key navigation with Enter to select
- Works with Bash and PowerShell

## Prerequisites

- Node.js 18+
- npm

## Installation

```bash
# Clone/navigate to the project
cd D:\projects\cli-explorer

# Install dependencies
npm install

# Build
npm run build

# Link globally (makes `projects-cli` available everywhere)
npm link
```

## Shell Setup

The CLI outputs a path to stdout. To actually `cd` into the selected directory, you need a shell wrapper.

### Git Bash

Add to `~/.bashrc`:

```bash
source D:/projects/cli-explorer/shell/projects.sh
```

Then reload:

```bash
source ~/.bashrc
```

### PowerShell

```powershell
# Create profile if it doesn't exist, then add the wrapper
if (!(Test-Path $PROFILE)) { New-Item $PROFILE -Force }
Add-Content $PROFILE "`n. D:\projects\cli-explorer\shell\projects.ps1"

# Reload
. $PROFILE
```

## Usage

```bash
# After shell setup, just run:
projects

# Or run the CLI directly (outputs path, doesn't cd):
projects-cli
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

# Run directly without global link
node dist/index.js
```

## Project Structure

```
cli-explorer/
├── src/
│   ├── index.tsx         # Entry point
│   ├── scanner.ts        # Scans D:\projects for folders
│   ├── history.ts        # Manages recent projects (~/.projects-cli/history.json)
│   ├── types.ts          # TypeScript types
│   └── components/
│       └── App.tsx       # ink (React) UI component
├── shell/
│   ├── projects.sh       # Bash wrapper
│   └── projects.ps1      # PowerShell wrapper
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## How It Works

1. `projects-cli` scans `D:\projects` for directories
2. Displays an interactive list with recent projects first
3. On selection, saves to history and prints the path to stdout
4. The shell wrapper captures the output and runs `cd`

## Configuration

History is stored at `~/.projects-cli/history.json`. Delete this file to reset recent projects.
