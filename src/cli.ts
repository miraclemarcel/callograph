#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createTsProgram } from "./analyzer/core/createProgram";
import { collectFunctions } from "./analyzer/core/collectFunctions";
import { buildCallGraph } from "./analyzer/core/buildCallGraph";
import { analyzePurity } from "./analyzer/purity/analyzePurity";
import { propagateImpurity } from "./analyzer/purity/propagateImpurity";
import { analyzeAsync } from "./analyzer/async/analyzeAsync";
import { propagateAsyncReturns } from "./analyzer/async/propagateAsyncReturns";
import { propagateAsyncRisk } from "./analyzer/async/propagateAsync";
import { AsyncSeverity } from "../libs/types";

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Callograph — Structural TypeScript Analyzer

Usage:
  callograph analyze [tsconfigPath]

Options:
  --fail-on-impure                 Exit with code 1 if impurity detected
  --fail-on-async                  Exit with code 1 if async issues detected
  --async-severity=error|warning|info
                                    Minimum async severity to report (default: error)
  --ignore=pattern1,pattern2       Comma-separated path substrings to ignore
  --json                           Output structured JSON
  --help                           Show this help message
`);
}

if (!command || command === "--help") {
  printHelp();
  process.exit(0);
}

if (command !== "analyze") {
  printHelp();
  process.exit(1);
}

const configPath =
  args[1] && !args[1].startsWith("--")
    ? args[1]
    : "tsconfig.json";

const failOnImpure = args.includes("--fail-on-impure");
const failOnAsync = args.includes("--fail-on-async");
const jsonOutput = args.includes("--json");

const severityArg = args.find(a =>
  a.startsWith("--async-severity=")
);

const severityThreshold: AsyncSeverity =
  (severityArg?.split("=")[1] as AsyncSeverity) ?? "error";

const severityRank: Record<AsyncSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

/* =============================
   SMART DEFAULT IGNORE
============================= */

const ignoreArg = args.find(a => a.startsWith("--ignore="));
const userIgnorePatterns = ignoreArg
  ? ignoreArg.split("=")[1].split(",")
  : [];

// Always ignore node_modules
let defaultIgnorePatterns: string[] = ["node_modules"];

try {
  const pkgPath = path.join(process.cwd(), "package.json");

  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    // If analyzing callograph itself
    if (pkg.name === "callograph") {
      defaultIgnorePatterns.push(
        "src/analyzer",
        "src/cli",
        "dist"
      );
    }
  }
} catch {
  // Fail silently if package.json parsing fails
}

const ignorePatterns = [
  ...defaultIgnorePatterns,
  ...userIgnorePatterns,
];

/* =============================
   PROGRAM + FUNCTION COLLECTION
============================= */

const program = createTsProgram(configPath);

const functions = collectFunctions(program).filter(fn =>
  !ignorePatterns.some(pattern =>
    fn.file.includes(pattern)
  )
);

const graph = buildCallGraph(program, functions);

/* =============================
   PURITY
============================= */

let purity = analyzePurity(program, functions);
purity = propagateImpurity(graph, purity);

/* =============================
   ASYNC
============================= */

let asyncResults = analyzeAsync(program, functions);
asyncResults = propagateAsyncReturns(graph, asyncResults);
asyncResults = propagateAsyncRisk(graph, asyncResults);

/* =============================
   JSON MODE
============================= */

if (jsonOutput) {
  const output = {
    callGraph: Array.from(graph.entries()).map(([caller, callees]) => ({
      caller,
      callees: Array.from(callees),
    })),
    purity,
    async: asyncResults,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

/* =============================
   TEXT MODE
============================= */

console.log("\nCall Graph:\n");

let edgeCount = 0;
for (const [caller, callees] of graph.entries()) {
  for (const callee of callees) {
    console.log(`${caller} → ${callee}`);
    edgeCount++;
  }
}
console.log(`\nTotal call edges: ${edgeCount}`);

/* =============================
   PURITY REPORT
============================= */

console.log("\nPurity Report:\n");

const impure = purity.filter(r => !r.isPure);

if (impure.length === 0) {
  console.log("All analyzed functions are pure.");
} else {
  for (const r of impure) {
    console.log(`${r.file}:${r.line}:${r.character}`);
    console.log(`Function: ${r.name}`);
    for (const reason of r.reasons) {
      console.log(`  - ${reason}`);
    }
    console.log("");
  }
}

if (failOnImpure && impure.length > 0) {
  process.exit(1);
}

/* =============================
   ASYNC REPORT
============================= */

console.log("\nAsync Safety Report:\n");

const filteredAsync = asyncResults.filter(r =>
  r.issues.some(issue =>
    severityRank[issue.severity] >= severityRank[severityThreshold]
  )
);

if (filteredAsync.length === 0) {
  console.log("No async issues detected.");
} else {
  for (const r of filteredAsync) {
    console.log(`${r.file}:${r.line}:${r.character}`);
    console.log(`Function: ${r.name}`);
    for (const issue of r.issues) {
      if (
        severityRank[issue.severity] >=
        severityRank[severityThreshold]
      ) {
        console.log(
          `  [${issue.severity.toUpperCase()}] ${issue.message}`
        );
      }
    }
    console.log("");
  }
}

if (failOnAsync && filteredAsync.length > 0) {
  process.exit(1);
}
