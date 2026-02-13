import ts from "typescript";

export interface FunctionNode {
  name: string;
  file: string;
  node: ts.FunctionLikeDeclaration;
}

export function collectFunctions(program: ts.Program): FunctionNode[] {
  const functions: FunctionNode[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (sourceFile.fileName.includes("node_modules")) continue;

    ts.forEachChild(sourceFile, function visit(node) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        const name =
          (node as any).name?.getText() || "<anonymous>";

        functions.push({
          name,
          file: sourceFile.fileName,
          node,
        });
      }

      ts.forEachChild(node, visit);
    });
  }

  return functions;
}
