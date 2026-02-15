import ts from "typescript";
import { FunctionNode } from "../../libs/types";
import { PurityResult } from "../../libs/types";


const GLOBALS = new Set([
  "window",
  "document",
  "global",
  "process",
  "localStorage",
  "sessionStorage",
]);

const KNOWN_IMPURE_CALLS = new Set([
  "Date.now",
  "Math.random",
  "console.log",
  "console.error",
  "console.warn",
  "fetch",
  "setTimeout",
  "setInterval",
]);

const MUTATING_ARRAY_METHODS = new Set([
  "push",
  "pop",
  "splice",
  "shift",
  "unshift",
  "sort",
  "reverse",
  "copyWithin",
  "fill",
]);

function isInside(node: ts.Node, container: ts.Node) {
  return node.pos >= container.pos && node.end <= container.end;
}

function rootIdentifier(expr: ts.Expression): ts.Identifier | null {
  if (ts.isIdentifier(expr)) return expr;
  if (ts.isPropertyAccessExpression(expr)) return rootIdentifier(expr.expression);
  if (ts.isElementAccessExpression(expr)) return rootIdentifier(expr.expression);
  if (ts.isParenthesizedExpression(expr)) return rootIdentifier(expr.expression);
  return null;
}

function getCallFullName(expr: ts.Expression): string | null {
  // Date.now, Math.random, console.log
  if (ts.isPropertyAccessExpression(expr)) {
    const left = expr.expression;
    const right = expr.name;
    if (ts.isIdentifier(left)) return `${left.text}.${right.text}`;
    return null;
  }
  if (ts.isIdentifier(expr)) return expr.text;
  return null;
}

function isWriteOperator(kind: ts.SyntaxKind) {
  return (
    kind === ts.SyntaxKind.EqualsToken ||
    kind === ts.SyntaxKind.PlusEqualsToken ||
    kind === ts.SyntaxKind.MinusEqualsToken ||
    kind === ts.SyntaxKind.AsteriskEqualsToken ||
    kind === ts.SyntaxKind.SlashEqualsToken ||
    kind === ts.SyntaxKind.PercentEqualsToken ||
    kind === ts.SyntaxKind.AmpersandEqualsToken ||
    kind === ts.SyntaxKind.BarEqualsToken ||
    kind === ts.SyntaxKind.CaretEqualsToken ||
    kind === ts.SyntaxKind.LessThanLessThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
    kind === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
  );
}

export function analyzePurity(
  program: ts.Program,
  functions: FunctionNode[]
): PurityResult[] {
  const checker = program.getTypeChecker();
  const results: PurityResult[] = [];

  for (const fn of functions) {
    const sf = fn.node.getSourceFile();
    const { line, character } = sf.getLineAndCharacterOfPosition(
      fn.node.getStart(sf)
    );

    const reasons: string[] = [];

    // collect parameter names
    const paramNames = new Set<string>();
    for (const p of fn.node.parameters) {
      if (ts.isIdentifier(p.name)) paramNames.add(p.name.text);
    }

    const mark = (reason: string) => {
      if (!reasons.includes(reason)) reasons.push(reason);
    };

    ts.forEachChild(fn.node, function visit(node) {
      // 1) Parameter mutation + outer-scope writes
      if (ts.isBinaryExpression(node)) {
        const isWrite = isWriteOperator(node.operatorToken.kind);

        if (isWrite) {
          // Parameter mutation (direct or deep): param =, param.x =, param[0] =
          const root = rootIdentifier(node.left as ts.Expression);
          if (root && paramNames.has(root.text)) {
            mark(`Mutates parameter \`${root.text}\``);
          }

          // Outer-scope writes: identifier assigned but declared outside this function
          if (ts.isIdentifier(node.left)) {
            const sym = checker.getSymbolAtLocation(node.left);
            const decls = sym?.getDeclarations?.() ?? [];
            const declaredInside = decls.some((d) => isInside(d, fn.node));
            if (sym && decls.length > 0 && !declaredInside) {
              mark(`Writes to outer scope \`${node.left.text}\``);
            }
          }

          // this.x = ...
          if (
            ts.isPropertyAccessExpression(node.left) &&
            node.left.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            mark(`Mutates \`this.${node.left.name.text}\``);
          }
        }
      }

      // 1b) Array mutation on parameters: param.push(...)
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const recv = node.expression.expression;
        const method = node.expression.name.text;
        const root = rootIdentifier(recv);

        if (root && paramNames.has(root.text) && MUTATING_ARRAY_METHODS.has(method)) {
          mark(`Mutates parameter \`${root.text}\` via \`${method}()\``);
        }
      }

      // 4) Accessing global state (basic)
      if (ts.isIdentifier(node) && GLOBALS.has(node.text)) {
        mark(`Accesses global \`${node.text}\``);
      }

      // 5) Calling known-impure functions (basic list)
      if (ts.isCallExpression(node)) {
        const full = getCallFullName(node.expression);
        if (full && KNOWN_IMPURE_CALLS.has(full)) {
          mark(`Calls known-impure \`${full}()\``);
        }
      }

      ts.forEachChild(node, visit);
    });

    results.push({
      id: fn.id,
      name: fn.name,
      file: fn.file,
      line: line + 1,
      character: character + 1,
      isPure: reasons.length === 0,
      reasons,
    });
  }

  return results;
}
