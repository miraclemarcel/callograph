import ts from "typescript";

export interface FunctionNode {
  id: string;
  name: string;
  file: string;
  node: ts.FunctionLikeDeclaration;
}

function safeName(node: ts.FunctionLikeDeclaration, sf: ts.SourceFile): string {
  const anyNode = node as any;

  // Named declarations / methods: function foo() {} / class X { foo() {} }
  if (anyNode.name && ts.isIdentifier(anyNode.name)) return anyNode.name.text;

  // Methods with string/numeric names: class X { "foo"() {} }
  if (anyNode.name && (ts.isStringLiteral(anyNode.name) || ts.isNumericLiteral(anyNode.name))) {
    return String(anyNode.name.text);
  }

  // const foo = () => {} / const foo = function() {}
  const p = node.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;

  // obj.foo = function() {}
  if (p && ts.isBinaryExpression(p) && ts.isPropertyAccessExpression(p.left)) {
    return p.left.name.text;
  }

  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `<anonymous@${line + 1}:${character + 1}>`;
}

export function collectFunctions(program: ts.Program): FunctionNode[] {
  const out: FunctionNode[] = [];

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    if (sf.fileName.includes("node_modules")) continue;

   ts.forEachChild(sf, function visit(n) {
    const isNamedFunctionDecl = ts.isFunctionDeclaration(n) && !!n.name;
    const isMethod = ts.isMethodDeclaration(n);

    const isVarAssigned =
      (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) &&
      ts.isVariableDeclaration(n.parent) &&
      ts.isIdentifier(n.parent.name);

    if (isNamedFunctionDecl || isMethod || isVarAssigned) {
      const name = safeName(n, sf);
      const id = `${sf.fileName}:${n.pos}:${name}`;
      out.push({ id, name, file: sf.fileName, node: n });
    }

    ts.forEachChild(n, visit);
  });

  }

  return out;
}
