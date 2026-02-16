import ts from "typescript";

/* ============================================================
   Promise Type Detection
============================================================ */

export function isPromiseLike(
  type: ts.Type,
  checker: ts.TypeChecker
): boolean {
  if (!type) return false;

  const thenProp = type.getProperty("then");
  if (!thenProp) return false;

  const decl = thenProp.valueDeclaration ?? thenProp.declarations?.[0];
  if (!decl) return false;

  const thenType = checker.getTypeOfSymbolAtLocation(thenProp, decl);
  return thenType.getCallSignatures().length > 0;
}

/* ============================================================
   Parent Chain Handling
============================================================ */

export function isAwaited(node: ts.CallExpression): boolean {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isAwaitExpression(current)) return true;
    if (ts.isReturnStatement(current)) return true;

    // Stop climbing at statement boundary
    if (ts.isExpressionStatement(current)) break;

    current = current.parent;
  }

  return false;
}

export function isReturned(node: ts.CallExpression): boolean {
  return ts.isReturnStatement(node.parent);
}

export function isHandledWithThen(node: ts.CallExpression): boolean {
  const parent = node.parent;

  if (!ts.isPropertyAccessExpression(parent)) return false;

  const name = parent.name.text;
  return name === "then" || name === "catch" || name === "finally";
}

/**
 * Enterprise-level handling detection
 * A promise is considered handled if:
 *  - awaited
 *  - returned
 *  - chained (.then/.catch/.finally)
 *  - assigned
 *  - passed as argument
 */

export function isHandled(node: ts.CallExpression): boolean {
  const parent = node.parent;

  if (
    ts.isAwaitExpression(parent) ||
    ts.isReturnStatement(parent) ||
    ts.isVariableDeclaration(parent) ||
    ts.isBinaryExpression(parent) ||
    ts.isCallExpression(parent) ||
    isHandledWithThen(node)
  ) {
    return true;
  }

  return false;
}

/* ============================================================
   Async Callback Detection
============================================================ */

const ASYNC_ARRAY_METHODS = new Set([
  "forEach",
  "map",
  "filter",
  "reduce",
]);

export function isAsyncArrayCallback(
  node: ts.CallExpression
): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;

  const method = node.expression.name.text;
  if (!ASYNC_ARRAY_METHODS.has(method)) return false;

  const cb = node.arguments[0];
  if (!cb) return false;

  if (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) {
    return (
      cb.modifiers?.some(
        m => m.kind === ts.SyntaxKind.AsyncKeyword
      ) ?? false
    );
  }

  return false;
}

export function isAsyncEventListener(
  node: ts.CallExpression
): boolean {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;

  if (node.expression.name.text !== "addEventListener") return false;

  const cb = node.arguments[1];
  if (!cb) return false;

  if (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) {
    return (
      cb.modifiers?.some(
        m => m.kind === ts.SyntaxKind.AsyncKeyword
      ) ?? false
    );
  }

  return false;
}

/* ============================================================
   Promise.all Detection
============================================================ */

export function isPromiseAll(node: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Promise" &&
    node.expression.name.text === "all"
  );
}

/* ============================================================
   Control Flow Helpers (used by asyncFlow)
============================================================ */

export function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

export function isConditional(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isConditionalExpression(node)
  );
}
