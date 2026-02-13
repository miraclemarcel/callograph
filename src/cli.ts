#!/usr/bin/env node
import { createTsProgram } from "./analyzer/createProgram";
import { collectFunctions } from "./analyzer/collectFunctions";
import { buildCallGraph } from "./analyzer/buildCallGraph";

const command = process.argv[2];

if (command !== "analyze") {
  console.log("Usage: callograph analyze");
  process.exit(1);
}

const program = createTsProgram("tsconfig.json");
const functions = collectFunctions(program);
const graph = buildCallGraph(program, functions);

console.log("\nCall Graph:\n");

for (const [fn, calls] of graph.entries()) {
  for (const call of calls) {
    console.log(`${fn} → ${call}`);
  }
}
