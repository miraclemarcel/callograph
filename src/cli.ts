#!/usr/bin/env node

import { createTsProgram } from "./analyzer/createProgram";
import { collectFunctions } from "./analyzer/collectFunctions";
import { buildCallGraph } from "./analyzer/buildCallGraph";
import { analyzePurity } from "./analyzer/purity";
import { propagateImpurity } from "./analyzer/propagateImpurity";

const args = process.argv.slice(2);
const command = args[0];

if (command !== "analyze") {
  console.log("Usage: callograph analyze [tsconfigPath] [--fail-on-impure]");
  process.exit(1);
}

const configPath = args[1] && !args[1].startsWith("--")
  ? args[1]
  : "tsconfig.json";

const failOnImpure = args.includes("--fail-on-impure");

const program = createTsProgram(configPath);
const functions = collectFunctions(program);
const graph = buildCallGraph(program, functions);

let purity = analyzePurity(program, functions);
purity = propagateImpurity(graph, purity);

const functionMap = new Map(functions.map(f => [f.id, f]));

/* ------------------------------
   CALL GRAPH
--------------------------------*/
console.log("\nCall Graph:\n");

let edgeCount = 0;

for (const [callerId, callees] of graph.entries()) {
  const caller = functionMap.get(callerId);
  const callerName = caller ? caller.name : callerId;

  for (const calleeId of callees) {
    const callee = functionMap.get(calleeId);
    const calleeName = callee ? callee.name : calleeId;

    console.log(`${callerName} → ${calleeName}`);
    edgeCount++;
  }
}

if (edgeCount === 0) {
  console.log("(no project-level call edges found)");
}

console.log(`\nTotal call edges: ${edgeCount}`);

/* ------------------------------
   PURITY REPORT
--------------------------------*/
console.log("\nPurity Report:\n");

const impure = purity.filter(r => !r.isPure);

if (impure.length === 0) {
  console.log("All analyzed functions are pure.");
} else {
  for (const r of impure) {
    console.log(`${r.file}:${r.line}:${r.character}`);
    console.log(`Function: ${r.name}`);
    console.log(`Status: X Impure`);
    console.log("Reasons:");
    for (const reason of r.reasons) {
      console.log(`  - ${reason}`);
    }
    console.log("");
  }
}

if (failOnImpure && impure.length > 0) {
  process.exit(1);
}
