import ts from "typescript";

export function isPromiseLike(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (!type) return false;

  const thenProp = type.getProperty("then");
  if (!thenProp) return false;

  const decl = thenProp.valueDeclaration ?? thenProp.declarations?.[0];
  if (!decl) return false;

  const thenType = checker.getTypeOfSymbolAtLocation(thenProp, decl);
  return thenType.getCallSignatures().length > 0;
}

export function isAwaited(node: ts.CallExpression) {
  return ts.isAwaitExpression(node.parent);
}

export function isReturned(node: ts.CallExpression) {
  return ts.isReturnStatement(node.parent);
}

export function isHandledWithThen(node: ts.CallExpression) {
  if (!ts.isPropertyAccessExpression(node.parent)) return false;
  const name = node.parent.name.text;
  return name === "then" || name === "catch" || name === "finally";
}

export function isAsyncForEach(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  if (node.expression.name.text !== "forEach") return false;

  const cb = node.arguments[0];
  if (!cb) return false;

  if (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) {
    return cb.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  }

  return false;
}

export function isAsyncEventListener(node: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  if (node.expression.name.text !== "addEventListener") return false;

  const cb = node.arguments[1];
  if (!cb) return false;

  if (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) {
    return cb.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  }

  return false;
}

export function isPromiseAll(node: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Promise" &&
    node.expression.name.text === "all"
  );
}
