import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { createInterface, Interface as ReadlineInterface } from "node:readline";
import { getCommandFile } from "./history.js";
import { loadSettings, saveSettings } from "./settings.js";

const COMMAND_FILE = getCommandFile();

// Convert Windows path to Git Bash format: C:\Users\foo -> /c/Users/foo
const toBashPath = (p: string) =>
  p.replace(/^([a-zA-Z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replace(/\\/g, "/");

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

/**
 * Format path for display (normalized for the current platform)
 */
function formatPathForDisplay(p: string): string {
  return resolve(p);
}

/**
 * Prompt user for projects directory with validation loop
 */
async function promptForPath(rl: ReadlineInterface, defaultPath: string): Promise<string> {
  const question = (prompt: string): Promise<string> => {
    return new Promise((res) => rl.question(prompt, res));
  };

  console.log("Enter your projects directory:");
  console.log(`(Leave empty to use the current folder: ${formatPathForDisplay(defaultPath)})`);

  while (true) {
    const answer = await question("> ");
    const path = resolve(answer.trim() || defaultPath);

    if (existsSync(path)) {
      return path;
    }

    console.log(`Path does not exist: ${path}`);
    console.log("Please enter a valid directory path:");
  }
}

/**
 * Prompt user for yes/no answer
 */
async function promptYesNo(rl: ReadlineInterface, prompt: string, defaultYes = true): Promise<boolean> {
  const question = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));
  const hint = defaultYes ? "[Y/n]" : "[y/N]";

  const answer = await question(`${prompt} ${hint} `);
  const trimmed = answer.trim().toLowerCase();

  if (trimmed === "") return defaultYes;
  return trimmed === "y" || trimmed === "yes";
}

// Shell wrapper scripts
function getBashWrapper(withAlias: boolean): string {
  let wrapper = `
# Dash CLI: Navigate to projects
dash() {
    dash-cli "$@"
    local cmd_file="${toBashPath(COMMAND_FILE)}"
    if [ -f "$cmd_file" ]; then
        . "$cmd_file"
        rm -f "$cmd_file"
    fi
}
`;
  if (withAlias) {
    wrapper += `alias d=dash
`;
  }
  return wrapper;
}

function getPowerShellWrapper(withAlias: boolean): string {
  const cmdFile = COMMAND_FILE.replace(/\\/g, "\\\\");
  // Build PowerShell script - use regular string to avoid template literal backtick issues
  const lines = [
    "",
    "# Dash CLI: Navigate to projects",
    "function dash {",
    "    $rawLine = $MyInvocation.Line",
    '    $rawArgs = ""',
    "    if ($rawLine -match '\\b(d|dash)\\s+(.*)$') {",
    "        $rawArgs = $Matches[2]",
    "    }",
    '    $exe = if ($IsWindows -or $PSVersionTable.PSVersion -lt "6.0") { ".exe" } else { "" }',
    "    $cmdSource = (Get-Command dash-cli).Source",
    "    $npmPrefix = Split-Path $cmdSource",
    '    $scriptPath = Join-Path $npmPrefix "node_modules\\dash-cli\\dist\\index.js"',
    "    if ($rawArgs) {",
    '        Invoke-Expression "node$exe `"$scriptPath`" $rawArgs"',
    "    } else {",
    "        & dash-cli",
    "    }",
    `    $cmdFile = "${cmdFile}"`,
    "    if (Test-Path $cmdFile) {",
    "        $commands = Get-Content $cmdFile -Raw",
    "        if ($commands) { Invoke-Expression $commands }",
    "        Remove-Item $cmdFile -Force -ErrorAction SilentlyContinue",
    "    }",
    "}",
  ];
  let wrapper = lines.join("\n");
  if (withAlias) {
    wrapper += "\nSet-Alias -Name d -Value dash\n";
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
  // Remove existing Dash CLI block (from marker to end of function + optional alias)
  const marker = "# Dash CLI:";
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
      if (line.trim().startsWith("alias d=") || line.trim().startsWith("Set-Alias")) {
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

function setupBash(withAlias: boolean): void {
  const configFile = getBashConfigFile();
  const bashConfigFile = toBashPath(configFile);
  const sourceCmd = `source ${bashConfigFile}`;
  let isUpdate = false;

  // Backup the file before modifying
  const backupPath = backupFile(configFile);
  if (backupPath) {
    console.log(`  Backup created: ${toBashPath(backupPath)}`);
  }

  // Remove existing config if present
  if (existsSync(configFile)) {
    let content = readFileSync(configFile, "utf-8");
    if (content.includes("# Dash CLI:")) {
      content = removeExistingConfig(content);
      writeFileSync(configFile, content);
      isUpdate = true;
    }
  }

  // Append wrapper
  appendFileSync(configFile, getBashWrapper(withAlias));
  console.log(`✓ ${isUpdate ? "Updated" : "Added to"} ${bashConfigFile}`);
  if (withAlias) {
    console.log("  Added 'd' alias for quick access.");
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
    if (content.includes("# Dash CLI:")) {
      content = removeExistingConfig(content);
      writeFileSync(profilePath, content);
      isUpdate = true;
    }
  }

  // Append wrapper
  appendFileSync(profilePath, getPowerShellWrapper(withAlias));
  console.log(`✓ ${isUpdate ? "Updated" : "Added to"} ${profilePath}`);
  if (withAlias) {
    console.log("  Added 'd' alias for quick access.");
  }
  console.log("\n  Reload with: . $PROFILE");
  console.log("  Or restart PowerShell.");
}

export async function runSetup(shellArg?: string, aliasArg?: string): Promise<void> {
  console.log("Setting up Dash CLI...\n");

  // Check for --alias flag
  const aliasProvided = shellArg === "--alias" || aliasArg === "--alias";
  const actualShellArg = shellArg === "--alias" ? undefined : shellArg;

  // Create readline interface for interactive prompts
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for projects directory
  const projectsDir = await promptForPath(rl, process.cwd());

  // Save settings
  const settings = loadSettings();
  settings.projectsDir = projectsDir;
  saveSettings(settings);
  console.log(`\n✓ Projects directory set to: ${formatPathForDisplay(projectsDir)}\n`);

  // Prompt for alias if not already specified via flag
  let withAlias = aliasProvided;
  if (!aliasProvided) {
    withAlias = await promptYesNo(rl, "Add 'd' as a shortcut alias?");
    console.log();
  }

  rl.close();

  // Determine shell
  let shell: Shell;

  if (actualShellArg === "bash") {
    shell = "bash";
  } else if (actualShellArg === "powershell" || actualShellArg === "pwsh") {
    shell = "powershell";
  } else if (actualShellArg) {
    console.error(`Unknown shell: ${actualShellArg}`);
    console.error("Usage: dash-cli --setup [bash|powershell] [--alias]");
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

  console.log("\nDone! You can now use 'dash' to navigate to your projects.");
  if (withAlias) {
    console.log("You can also use 'd' as a shortcut.");
  }
}
