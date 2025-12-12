import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { getSelectionFile } from "./history.js";

const SELECTION_FILE = getSelectionFile();

// Shell wrapper scripts
const BASH_WRAPPER = `
# projects-cli: Navigate to projects
projects() {
    projects-cli
    local selected
    selected=$(cat "${SELECTION_FILE.replace(/\\/g, "/")}" 2>/dev/null)
    if [ -n "$selected" ] && [ -d "$selected" ]; then
        cd "$selected" || return 1
    fi
}
`;

const POWERSHELL_WRAPPER = `
# projects-cli: Navigate to projects
function projects {
    projects-cli
    $selectionFile = "${SELECTION_FILE.replace(/\\/g, "\\\\")}"
    if (Test-Path $selectionFile) {
        $selected = Get-Content $selectionFile -Raw
        if ($selected -and (Test-Path $selected.Trim())) {
            Set-Location $selected.Trim()
        }
    }
}
`;

type Shell = "bash" | "powershell" | "auto";

function detectShell(): Shell {
  const shell = process.env.SHELL || "";
  const psModulePath = process.env.PSModulePath;

  if (psModulePath) {
    return "powershell";
  }
  if (shell.includes("bash") || shell.includes("zsh")) {
    return "bash";
  }

  // Default based on platform
  return process.platform === "win32" ? "powershell" : "bash";
}

function getBashConfigFile(): string {
  const home = homedir();

  // Prefer .bashrc, fall back to .bash_profile
  const bashrc = join(home, ".bashrc");
  const bashProfile = join(home, ".bash_profile");

  if (existsSync(bashrc)) {
    return bashrc;
  }
  if (existsSync(bashProfile)) {
    return bashProfile;
  }

  // Create .bashrc if neither exists
  return bashrc;
}

function getPowerShellProfile(): string {
  // PowerShell profile location
  const home = homedir();

  if (process.platform === "win32") {
    // Windows PowerShell and PowerShell Core
    const psCore = join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1");
    const psWindows = join(home, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");

    // Prefer PowerShell Core
    if (existsSync(dirname(psCore))) {
      return psCore;
    }
    return psWindows;
  }

  // macOS/Linux PowerShell Core
  return join(home, ".config", "powershell", "Microsoft.PowerShell_profile.ps1");
}

function setupBash(): void {
  const configFile = getBashConfigFile();
  const marker = "# projects-cli:";

  // Check if already configured
  if (existsSync(configFile)) {
    const content = readFileSync(configFile, "utf-8");
    if (content.includes(marker)) {
      console.log(`✓ Already configured in ${configFile}`);
      console.log("  Run 'source " + configFile + "' or restart your terminal.");
      return;
    }
  }

  // Append wrapper
  appendFileSync(configFile, BASH_WRAPPER);
  console.log(`✓ Added to ${configFile}`);
  console.log("  Run 'source " + configFile + "' or restart your terminal.");
}

function setupPowerShell(): void {
  const profilePath = getPowerShellProfile();
  const marker = "# projects-cli:";

  // Ensure directory exists
  const profileDir = dirname(profilePath);
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  // Check if already configured
  if (existsSync(profilePath)) {
    const content = readFileSync(profilePath, "utf-8");
    if (content.includes(marker)) {
      console.log(`✓ Already configured in ${profilePath}`);
      console.log("  Run '. $PROFILE' or restart PowerShell.");
      return;
    }
  }

  // Append wrapper
  appendFileSync(profilePath, POWERSHELL_WRAPPER);
  console.log(`✓ Added to ${profilePath}`);
  console.log("  Run '. $PROFILE' or restart PowerShell.");
}

export async function runSetup(shellArg?: string): Promise<void> {
  console.log("Setting up projects-cli...\n");

  let shell: Shell;

  if (shellArg === "bash") {
    shell = "bash";
  } else if (shellArg === "powershell" || shellArg === "pwsh") {
    shell = "powershell";
  } else if (shellArg) {
    console.error(`Unknown shell: ${shellArg}`);
    console.error("Usage: projects-cli --setup [bash|powershell]");
    process.exit(1);
  } else {
    shell = detectShell();
    console.log(`Detected shell: ${shell}`);
  }

  if (shell === "bash") {
    setupBash();
  } else {
    setupPowerShell();
  }

  console.log("\nDone! You can now use 'projects' to navigate to your projects.");
}
