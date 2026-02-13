import ts from "typescript";
import { FunctionNode } from "./collectFunctions";

export type CallGraph = Map<string, Set<string>>;

export function buildCallGraph(
  program: ts.Program,
  functions: FunctionNode[]
): CallGraph {
  const checker = program.getTypeChecker();
  const graph: CallGraph = new Map();

  const functionMap = new Map<string, ts.FunctionLikeDeclaration>();

  for (const fn of functions) {
    functionMap.set(fn.name, fn.node);
    graph.set(fn.name, new Set());
  }

  for (const fn of functions) {
    const fnName = fn.name;

    ts.forEachChild(fn.node, function visit(node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const symbol = checker.getSymbolAtLocation(expression);

        if (symbol) {
          const name = symbol.getName();
          if (graph.has(fnName)) {
            graph.get(fnName)!.add(name);
          }
        }
      }

      ts.forEachChild(node, visit);
    });
  }

  return graph;
}
