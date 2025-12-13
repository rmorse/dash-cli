import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { getSelectionFile } from "./history.js";

const SELECTION_FILE = getSelectionFile();

/**
 * Create a backup of a file before modifying it.
 * Uses .bkp, .bkp1, .bkp2, etc. to find an unused filename.
 */
function backupFile(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  // Try .bkp first, then .bkp1, .bkp2, etc.
  let backupPath = `${filePath}.bkp`;
  let counter = 1;

  while (existsSync(backupPath)) {
    backupPath = `${filePath}.bkp${counter}`;
    counter++;
  }

  copyFileSync(filePath, backupPath);
  return backupPath;
}

// Shell wrapper scripts
function getBashWrapper(withAlias: boolean): string {
  let wrapper = `
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
  if (withAlias) {
    wrapper += `alias p=projects
`;
  }
  return wrapper;
}

function getPowerShellWrapper(withAlias: boolean): string {
  let wrapper = `
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
  if (withAlias) {
    wrapper += `Set-Alias -Name p -Value projects
`;
  }
  return wrapper;
}

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
  const shell = process.env.SHELL || "";

  // Check if using zsh
  if (shell.includes("zsh")) {
    const zshrc = join(home, ".zshrc");
    if (existsSync(zshrc)) {
      return zshrc;
    }
    // Create .zshrc if it doesn't exist
    return zshrc;
  }

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

function removeExistingConfig(content: string): string {
  // Remove existing projects-cli block (from marker to end of function + optional alias)
  const marker = "# projects-cli:";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) return content;

  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;
  let braceDepth = 0;
  let skipNextAlias = false;

  for (const line of lines) {
    if (line.includes(marker)) {
      inBlock = true;
      braceDepth = 0;
      continue;
    }

    if (inBlock) {
      // Count braces to find end of function
      for (const char of line) {
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }

      // Function ended when we return to 0 depth after going positive
      if (braceDepth <= 0 && line.includes("}")) {
        inBlock = false;
        skipNextAlias = true;
        continue;
      }
      continue;
    }

    // Skip alias line right after function
    if (skipNextAlias) {
      skipNextAlias = false;
      if (line.trim().startsWith("alias p=") || line.trim().startsWith("Set-Alias")) {
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

function setupBash(withAlias: boolean): void {
  const configFile = getBashConfigFile();
  const sourceCmd = `source ${configFile}`;
  let isUpdate = false;

  // Backup the file before modifying
  const backupPath = backupFile(configFile);
  if (backupPath) {
    console.log(`  Backup created: ${backupPath}`);
  }

  // Remove existing config if present
  if (existsSync(configFile)) {
    let content = readFileSync(configFile, "utf-8");
    if (content.includes("# projects-cli:")) {
      content = removeExistingConfig(content);
      writeFileSync(configFile, content);
      isUpdate = true;
    }
  }

  // Append wrapper
  appendFileSync(configFile, getBashWrapper(withAlias));
  console.log(`✓ ${isUpdate ? "Updated" : "Added to"} ${configFile}`);
  if (withAlias) {
    console.log("  Added 'p' alias for quick access.");
  }
  console.log(`\n  Reload with: ${sourceCmd}`);
  console.log("  Or restart your terminal.");
}

function setupPowerShell(withAlias: boolean): void {
  const profilePath = getPowerShellProfile();
  let isUpdate = false;

  // Ensure directory exists
  const profileDir = dirname(profilePath);
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
  }

  // Backup the file before modifying
  const backupPath = backupFile(profilePath);
  if (backupPath) {
    console.log(`  Backup created: ${backupPath}`);
  }

  // Remove existing config if present
  if (existsSync(profilePath)) {
    let content = readFileSync(profilePath, "utf-8");
    if (content.includes("# projects-cli:")) {
      content = removeExistingConfig(content);
      writeFileSync(profilePath, content);
      isUpdate = true;
    }
  }

  // Append wrapper
  appendFileSync(profilePath, getPowerShellWrapper(withAlias));
  console.log(`✓ ${isUpdate ? "Updated" : "Added to"} ${profilePath}`);
  if (withAlias) {
    console.log("  Added 'p' alias for quick access.");
  }
  console.log("\n  Reload with: . $PROFILE");
  console.log("  Or restart PowerShell.");
}

export async function runSetup(shellArg?: string, aliasArg?: string): Promise<void> {
  console.log("Setting up projects-cli...\n");

  // Check for --alias flag
  const withAlias = shellArg === "--alias" || aliasArg === "--alias";
  const actualShellArg = shellArg === "--alias" ? undefined : shellArg;

  let shell: Shell;

  if (actualShellArg === "bash") {
    shell = "bash";
  } else if (actualShellArg === "powershell" || actualShellArg === "pwsh") {
    shell = "powershell";
  } else if (actualShellArg) {
    console.error(`Unknown shell: ${actualShellArg}`);
    console.error("Usage: projects-cli --setup [bash|powershell] [--alias]");
    process.exit(1);
  } else {
    shell = detectShell();
    console.log(`Detected shell: ${shell}`);
  }

  if (shell === "bash") {
    setupBash(withAlias);
  } else {
    setupPowerShell(withAlias);
  }

  console.log("\nDone! You can now use 'projects' to navigate to your projects.");
  if (withAlias) {
    console.log("You can also use 'p' as a shortcut.");
  }
}
