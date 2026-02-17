import ts from "typescript";
import { FunctionNode } from "../../../libs/types";

// callerId -> calleeIds
export type CallGraph = Map<string, Set<string>>;

function isProjectFile(fileName: string) {
  return !fileName.includes("node_modules") && !fileName.endsWith(".d.ts");
}

export function buildCallGraph(
  program: ts.Program,
  functions: FunctionNode[]
): CallGraph {

  const checker = program.getTypeChecker();
  const graph: CallGraph = new Map();

  const declToId = new Map<ts.Declaration, string>();

  for (const fn of functions) {
    graph.set(fn.id, new Set());
    declToId.set(fn.node, fn.id);
  }

  for (const fn of functions) {
    const callerId = fn.id;

    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const sig = checker.getResolvedSignature(node);
        const decl = sig?.getDeclaration();

        if (
          decl &&
          isProjectFile(decl.getSourceFile().fileName)
        ) {
          const calleeId = declToId.get(decl as ts.Declaration);

          if (calleeId) {
            graph.get(callerId)!.add(calleeId);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(fn.node);
  }

  return graph;
}
