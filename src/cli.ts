#!/usr/bin/env node
import { createTsProgram } from "./analyzer/createProgram";
import { collectFunctions } from "./analyzer/collectFunctions";
import { buildCallGraph } from "./analyzer/buildCallGraph";
import { analyzePurity } from "./analyzer/purity";
import { propagateImpurity } from "./analyzer/propagateImpurity";

const command = process.argv[2];

if (command !== "analyze") {
  console.log("Usage: callograph analyze");
  process.exit(1);
}

const program = createTsProgram("tsconfig.json");
const functions = collectFunctions(program);
const graph = buildCallGraph(program, functions);

let purity = analyzePurity(program, functions);
purity = propagateImpurity(graph, purity);

/* ------------------------------
   CALL GRAPH
--------------------------------*/
console.log("\nCall Graph:\n");

let edgeCount = 0;

for (const [callerId, callees] of graph.entries()) {
  const caller = functions.find(f => f.id === callerId);
  const callerName = caller ? caller.name : callerId;

  for (const calleeId of callees) {
    const callee = functions.find(f => f.id === calleeId);
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
