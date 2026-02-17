import ts from "typescript";
import {
  AsyncIssue,
  AsyncSeverity,
  FunctionNode,
} from "../../../libs/types";
import {
  isPromiseLike,
  isHandled,
  isPromiseAll,
  isAsyncArrayCallback,
  isAsyncEventListener,
  isLoop,
} from "./asyncHelpers";

export interface AsyncFlowAnalysis {
  issues: AsyncIssue[];
  returnsPromise: boolean;
  callsReturningPromise: string[];
}

export function analyzeFunctionAsync(
  fn: FunctionNode,
  program: ts.Program
): AsyncFlowAnalysis {

  const checker = program.getTypeChecker();
  const issues: AsyncIssue[] = [];
  const callsReturningPromise: string[] = [];

  let returnsPromise = false;
  let containsAwait = false;
  let hasTryCatch = false;

  const isAsyncFunction =
    fn.node.modifiers?.some(
      m => m.kind === ts.SyntaxKind.AsyncKeyword
    ) ?? false;

  const mark = (message: string, severity: AsyncSeverity) => {
    issues.push({ message, severity });
  };

  function visit(node: ts.Node, insideLoop = false) {

    /* --------------------------
       Loop tracking
    -------------------------- */
    if (isLoop(node)) {
      ts.forEachChild(node, n => visit(n, true));
      return;
    }

    /* --------------------------
       Await tracking
    -------------------------- */
    if (ts.isAwaitExpression(node)) {
      containsAwait = true;
    }

    /* --------------------------
       Try/catch tracking
    -------------------------- */
    if (ts.isTryStatement(node) && node.catchClause) {
      hasTryCatch = true;
    }

    /* --------------------------
       Call expression analysis
    -------------------------- */
    if (ts.isCallExpression(node)) {
      const type = checker.getTypeAtLocation(node);

      if (isPromiseLike(type, checker)) {
        returnsPromise = true;

        const handled = isHandled(node);

        if (!handled) {
          mark(
            insideLoop
              ? "Floating promise inside loop"
              : "Floating promise",
            insideLoop ? "warning" : "error"
          );
        }

        const sig = checker.getResolvedSignature(node);
        const decl = sig?.getDeclaration();

        if (decl && decl.getSourceFile().fileName.includes(process.cwd())) {
          const id = `${decl.getSourceFile().fileName}:${decl.pos}`;
          callsReturningPromise.push(id);
        }
      }

      /* ---- Promise.all ---- */
      if (isPromiseAll(node)) {

        if (!isHandled(node)) {
          mark("Unawaited Promise.all()", "error");
        }

        const arg = node.arguments[0];

        if (arg && ts.isArrayLiteralExpression(arg)) {
          for (const element of arg.elements) {
            const elementType =
              checker.getTypeAtLocation(element);

            if (isPromiseLike(elementType, checker)) {
              if (!isHandled(node)) {
                mark(
                  "Promise.all contains unhandled promise",
                  "error"
                );
              }
            }
          }
        }
      }

      /* ---- Async callbacks ---- */
      if (isAsyncArrayCallback(node)) {
        mark(
          "Async callback inside array method",
          "warning"
        );
      }

      if (isAsyncEventListener(node)) {
        mark(
          "Async event listener without boundary",
          "warning"
        );
      }
    }

    /* --------------------------
       Error swallowing detection
    -------------------------- */
    if (ts.isPropertyAccessExpression(node)) {
      if (
        node.name.text === "catch" &&
        ts.isCallExpression(node.parent)
      ) {
        const cb = node.parent.arguments[0];

        if (
          cb &&
          (ts.isArrowFunction(cb) ||
            ts.isFunctionExpression(cb)) &&
          cb.body &&
          ts.isBlock(cb.body) &&
          cb.body.statements.length === 0
        ) {
          mark("Error swallowed in .catch()", "error");
        }
      }
    }

    ts.forEachChild(node, n => visit(n, insideLoop));
  }

  visit(fn.node);

  /* ==========================================
     NEW RULE — Async function with await
     but no error boundary
  ========================================== */

  if (
    isAsyncFunction &&
    containsAwait &&
    !hasTryCatch
  ) {
    mark(
      "Async function contains await but has no error boundary (try/catch)",
      "warning"
    );
  }

  return {
    issues,
    returnsPromise,
    callsReturningPromise,
  };
}
