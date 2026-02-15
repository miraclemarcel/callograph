import ts from "typescript";
import { FunctionNode, PurityResult } from "../../libs/types";
import { GLOBAL_OBJECTS, MUTATING_ARRAY_METHODS } from "./helpers/globals";
import { isInside, rootIdentifier, isWriteOperator } from "./helpers/ast";
import {
  isPromiseLike,
  isAwaited,
  isReturned,
  isHandledWithThen,
  isAsyncForEach,
  isAsyncEventListener,
  isPromiseAll,
} from "./helpers/async";

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
    let hasTryCatch = false;

    const isAsyncFunction =
      fn.node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;

    function visit(node: ts.Node): void {
      /* ---------------------------
         WRITE DETECTION
      ----------------------------*/
      if (ts.isBinaryExpression(node) && isWriteOperator(node.operatorToken.kind)) {
        const left = node.left as ts.Expression;
        const root = rootIdentifier(left);

        if (root && paramNames.has(root.text)) {
          mark(`Mutates parameter \`${root.text}\``);
        }

        if (ts.isIdentifier(left)) {
          const sym = checker.getSymbolAtLocation(left);
          const decls = sym?.getDeclarations() ?? [];
          const declaredInside = decls.some(d => isInside(d, fn.node));
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

      /* ---------------------------
         ARRAY PARAM MUTATION
      ----------------------------*/
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const root = rootIdentifier(node.expression.expression);

        if (root && paramNames.has(root.text) && MUTATING_ARRAY_METHODS.has(method)) {
          mark(`Mutates parameter \`${root.text}\` via \`${method}()\``);
        }
      }

      /* ---------------------------
         GLOBAL ACCESS
      ----------------------------*/
      if (ts.isIdentifier(node)) {
        const sym = checker.getSymbolAtLocation(node);
        if (sym && GLOBAL_OBJECTS.has(sym.getName())) {
          mark(`Accesses global \`${sym.getName()}\``);
        }
      }

      if (ts.isPropertyAccessExpression(node)) {
        const root = rootIdentifier(node.expression);

        if (root?.text === "process" && node.name.text === "env") {
          mark("Accesses `process.env` (non-deterministic)");
        }

        if (root?.text === "console") {
          mark("Writes to console");
        }
      }

      /* ---------------------------
         CALL EXPRESSIONS
      ----------------------------*/
      if (ts.isCallExpression(node)) {
        const type = checker.getTypeAtLocation(node);
        const expr = node.expression;

        // Non-deterministic
        if (
          ts.isPropertyAccessExpression(expr) &&
          ts.isIdentifier(expr.expression) &&
          expr.expression.text === "Date" &&
          expr.name.text === "now"
        ) {
          mark("Calls Date.now() (non-deterministic)");
        }

        if (
          ts.isPropertyAccessExpression(expr) &&
          ts.isIdentifier(expr.expression) &&
          expr.expression.text === "Math" &&
          expr.name.text === "random"
        ) {
          mark("Calls Math.random() (non-deterministic)");
        }

        // Async rules
        if (isPromiseLike(type, checker)) {
          if (!isAwaited(node) && !isReturned(node) && !isHandledWithThen(node)) {
            mark("Floating Promise (result ignored)");
          }
        }

        if (isPromiseAll(node) && !isAwaited(node) && !isReturned(node)) {
          mark("Unawaited Promise.all()");
        }

        if (isAsyncForEach(node)) {
          mark("Async callback inside forEach (not awaited)");
        }

        if (isAsyncEventListener(node)) {
          mark("Async event listener without error boundary");
        }
      }

      /* ---------------------------
         NEW EXPRESSIONS
      ----------------------------*/
      if (ts.isNewExpression(node)) {
        if (ts.isIdentifier(node.expression) && node.expression.text === "Date") {
          mark("Instantiates Date (non-deterministic)");
        }
      }

      /* ---------------------------
         AWAIT + ERROR HANDLING
      ----------------------------*/
      if (ts.isAwaitExpression(node)) {
        containsAwait = true;
      }

      if (ts.isTryStatement(node) && node.catchClause) {
        hasTryCatch = true;
      }

      if (ts.isCatchClause(node) && node.block.statements.length === 0) {
        mark("Empty catch block (error swallowed)");
      }

      ts.forEachChild(node, visit);
    }

    visit(fn.node);

    if (isAsyncFunction && !containsAwait) {
      mark("Async function without await");
    }

    if (isAsyncFunction && containsAwait && !hasTryCatch) {
      mark("Async function without error handling (no try/catch)");
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
