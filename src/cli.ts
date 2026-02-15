import { createTsProgram } from "./analyzer/createProgram";
import { collectFunctions } from "./analyzer/collectFunctions";
import { buildCallGraph } from "./analyzer/buildCallGraph";
import { analyzePurity } from "./analyzer/purity";

const command = process.argv[2];

if (command !== "analyze") {
  console.log("Usage: callograph analyze");
  process.exit(1);
}

const program = createTsProgram("tsconfig.json");
const functions = collectFunctions(program);
const graph = buildCallGraph(program, functions);

console.log("\nCall Graph:\n");
const purity = analyzePurity(program, functions);

console.log("\nPurity Report:\n");

for (const r of purity.filter((x) => !x.isPure)) {
  console.log(`${r.file}:${r.line}:${r.character}`);
  console.log(`Function: ${r.name}`);
  console.log(`Status: X Impure`);
  console.log(`Reasons:`);
  for (const reason of r.reasons) console.log(`  - ${reason}`);
  console.log("");
}


for (const [fn, calls] of graph.entries()) {
  for (const call of calls) {
    console.log(`${fn} → ${call}`);
  }
}
