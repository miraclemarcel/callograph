import { CallGraph } from "../core/buildCallGraph";
import { AsyncResult } from "../../../libs/types";

export function propagateAsyncReturns(
  graph: CallGraph,
  results: AsyncResult[]
): AsyncResult[] {

  const map = new Map(results.map(r => [r.id, r]));

  let changed = true;

  while (changed) {
    changed = false;

    for (const [callerId, callees] of graph.entries()) {
      const caller = map.get(callerId);
      if (!caller) continue;

      for (const calleeId of callees) {
        const callee = map.get(calleeId);
        if (!callee) continue;

        const calleeReturnsPromise = callee.issues.some(i =>
          i.message.includes("Floating") ||
          i.message.includes("Promise")
        );

        if (calleeReturnsPromise) {
          const alreadyHas = caller.issues.some(i =>
            i.message === "Calls promise-returning function without await"
          );

          if (!alreadyHas) {
            caller.issues.push({
              message: "Calls promise-returning function without await",
              severity: "error",
            });

            changed = true;
          }
        }
      }
    }
  }

  return Array.from(map.values());
}
