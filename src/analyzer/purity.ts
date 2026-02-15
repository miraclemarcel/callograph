import ts from "typescript";
import { FunctionNode, PurityResult } from "../../libs/types";

const GLOBAL_OBJECTS = new Set([
  "window",
  "document",
  "global",
  "process",
  "localStorage",
  "sessionStorage",
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

function rootIdentifier(expr: ts.Expression): ts.Identifier | null {
  if (ts.isIdentifier(expr)) return expr;
  if (ts.isPropertyAccessExpression(expr)) return rootIdentifier(expr.expression);
  if (ts.isElementAccessExpression(expr)) return rootIdentifier(expr.expression);
  if (ts.isParenthesizedExpression(expr)) return rootIdentifier(expr.expression);
  return null;
}

function isPromiseLike(type: ts.Type): boolean {
  if (!type) return false;

  const symbol = type.getSymbol();
  if (!symbol) return false;

  const name = symbol.getName();

  // Direct Promise
  if (name === "Promise") return true;

  // Thenable detection
  const thenProp = type.getProperty("then");
  return !!thenProp;
}


function isAwaited(node: ts.CallExpression) {
  return ts.isAwaitExpression(node.parent);
}

function isHandledWithThen(node: ts.CallExpression) {
  if (!ts.isPropertyAccessExpression(node.parent)) return false;
  return node.parent.name.text === "then" || node.parent.name.text === "catch";
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
    const paramNames = new Set<string>();

    for (const p of fn.node.parameters) {
      if (ts.isIdentifier(p.name)) paramNames.add(p.name.text);
    }

    const mark = (reason: string) => {
      if (!reasons.includes(reason)) reasons.push(reason);
    };

    let containsAwait = false;
    const isAsyncFunction =
      (fn.node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) ??
      false;

    function visit(node: ts.Node): void {
      /* ---------------------------------------
         PARAMETER + OUTER SCOPE WRITES
      ----------------------------------------*/
      if (ts.isBinaryExpression(node)) {
        if (isWriteOperator(node.operatorToken.kind)) {
          const left = node.left as ts.Expression;
          const root = rootIdentifier(left);

          if (root && paramNames.has(root.text)) {
            mark(`Mutates parameter \`${root.text}\``);
          }

          if (ts.isIdentifier(left)) {
            const sym = checker.getSymbolAtLocation(left);
            const decls = sym?.getDeclarations() ?? [];
            const declaredInside = decls.some((d) => isInside(d, fn.node));
            if (sym && decls.length > 0 && !declaredInside) {
              mark(`Writes to outer scope \`${left.text}\``);
            }
          }

          if (
            ts.isPropertyAccessExpression(left) &&
            left.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            mark(`Mutates \`this.${left.name.text}\``);
          }
        }
      }

      /* ---------------------------------------
         ARRAY MUTATION ON PARAMS
      ----------------------------------------*/
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const root = rootIdentifier(node.expression.expression);

        if (root && paramNames.has(root.text) && MUTATING_ARRAY_METHODS.has(method)) {
          mark(`Mutates parameter \`${root.text}\` via \`${method}()\``);
        }
      }

      /* ---------------------------------------
         GLOBAL ACCESS DETECTION (SOLID)
      ----------------------------------------*/
      if (ts.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        if (!symbol) return;

        const name = symbol.getName();

        if (GLOBAL_OBJECTS.has(name)) {
          mark(`Accesses global \`${name}\``);
        }
      }

      if (ts.isPropertyAccessExpression(node)) {
        const left = node.expression;
        const leftRoot = rootIdentifier(left);

        if (leftRoot?.text === "process" && node.name.text === "env") {
          mark("Accesses `process.env` (non-deterministic)");
        }

        if (leftRoot?.text === "console") {
          mark("Writes to console");
        }
      }

    // CALL EXPRESSIONS
    if (ts.isCallExpression(node)) {
    const type = checker.getTypeAtLocation(node);
    const expr = node.expression;

    // Date.now()
    if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === "Date" &&
        expr.name.text === "now"
    ) {
        mark("Calls Date.now() (non-deterministic)");
    }

    // Math.random()
    if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === "Math" &&
        expr.name.text === "random"
    ) {
        mark("Calls Math.random() (non-deterministic)");
    }

    // Async safety
    if (isPromiseLike(type)) {
        if (!isAwaited(node) && !isHandledWithThen(node)) {
        mark("Unawaited Promise (fire-and-forget async)");
        }
    }
    }

    // NEW EXPRESSIONS
    if (ts.isNewExpression(node)) {
    if (ts.isIdentifier(node.expression)) {
        if (node.expression.text === "Date") {
        mark("Instantiates Date (non-deterministic)");
        }
    }
    }


      if (ts.isAwaitExpression(node)) {
        containsAwait = true;
      }

      ts.forEachChild(node, visit);
    }

    visit(fn.node);

    if (isAsyncFunction && !containsAwait) {
      mark("Async function without await");
    }

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
