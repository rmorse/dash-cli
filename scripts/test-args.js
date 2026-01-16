#!/usr/bin/env node
// Diagnostic script to see what arguments actually reach Node.js
// Run in PowerShell: node scripts/test-args.js -- add proj "echo test"
// Run in PowerShell: node scripts/test-args.js '--' add proj "echo test"

console.log("process.argv:");
process.argv.forEach((arg, i) => {
  console.log(`  [${i}]: "${arg}"`);
});

console.log("\nArgs after slice(2):");
const args = process.argv.slice(2);
args.forEach((arg, i) => {
  console.log(`  [${i}]: "${arg}"`);
});

console.log("\nHas '--' separator:", args.includes("--"));
