import ts from "typescript";
import path from "path";
import { FunctionNode } from "../../../libs/types";

function safeName(
  node: ts.FunctionLikeDeclaration,
  sf: ts.SourceFile
): string {
  const anyNode = node as any;

  if (anyNode.name && ts.isIdentifier(anyNode.name)) {
    return anyNode.name.text;
  }

  if (
    anyNode.name &&
    (ts.isStringLiteral(anyNode.name) ||
      ts.isNumericLiteral(anyNode.name))
  ) {
    return String(anyNode.name.text);
  }

  const p = node.parent;

  if (
    p &&
    ts.isVariableDeclaration(p) &&
    ts.isIdentifier(p.name)
  ) {
    return p.name.text;
  }

  if (
    p &&
    ts.isBinaryExpression(p) &&
    ts.isPropertyAccessExpression(p.left)
  ) {
    return p.left.name.text;
  }

  const { line, character } =
    sf.getLineAndCharacterOfPosition(
      node.getStart(sf)
    );

  return `<anonymous@${line + 1}:${character + 1}>`;
}

export function collectFunctions(
  program: ts.Program,
  ignorePatterns: string[] = []
): FunctionNode[] {

  const out: FunctionNode[] = [];

  const normalizedIgnore = ignorePatterns.map(p =>
    p.replace(/\\/g, "/")
  );

  for (const sf of program.getSourceFiles()) {

    if (sf.isDeclarationFile) continue;

    const normalizedFile = sf.fileName.replace(/\\/g, "/");

    if (
      normalizedIgnore.some(pattern =>
        normalizedFile.includes(pattern)
      )
    ) {
      continue;
    }

    ts.forEachChild(sf, function visit(n) {

      const isNamedFunctionDecl =
        ts.isFunctionDeclaration(n) && !!n.name;

      const isMethod =
        ts.isMethodDeclaration(n);

      const p = n.parent;

      const isVarAssigned =
        (ts.isArrowFunction(n) ||
          ts.isFunctionExpression(n)) &&
        !!p &&
        ts.isVariableDeclaration(p) &&
        ts.isIdentifier(p.name);

      if (isNamedFunctionDecl || isMethod || isVarAssigned) {

        const name = safeName(n, sf);

        const id = `${normalizedFile}:${n.pos}:${name}`;

        out.push({
          id,
          name,
          file: normalizedFile,
          node: n,
        });
      }

      ts.forEachChild(n, visit);
    });
  }

  return out;
}
