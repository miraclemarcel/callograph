import ts from "typescript";
import { FunctionNode } from "./collectFunctions";

export type CallGraph = Map<string, Set<string>>; 

function isProjectFile(fileName: string) {
  return !fileName.includes("node_modules") && !fileName.endsWith(".d.ts");
}

function getProjectDeclarationFile(symbol: ts.Symbol): string | null {
  const decls = symbol.getDeclarations() ?? [];
  for (const d of decls) {
    const sf = d.getSourceFile();
    if (sf && isProjectFile(sf.fileName)) return sf.fileName;
  }
  return null;
}

export function buildCallGraph(program: ts.Program, functions: FunctionNode[]): CallGraph {
  const checker = program.getTypeChecker();
  const graph: CallGraph = new Map();

  for (const fn of functions) graph.set(fn.id, new Set());

  for (const fn of functions) {
    const callerId = fn.id;

    ts.forEachChild(fn.node, function visit(node) {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;

        const symbol = checker.getSymbolAtLocation(expr);
        if (!symbol) {
          ts.forEachChild(node, visit);
          return;
        }

        // Only include calls where callee is declared in project source files
        const calleeFile = getProjectDeclarationFile(symbol);
        if (!calleeFile) {
          ts.forEachChild(node, visit);
          return;
        }

        const calleeName = symbol.getName();
        graph.get(callerId)!.add(`${calleeName} (${calleeFile})`);
      }

      ts.forEachChild(node, visit);
    });
  }

  return graph;
}
