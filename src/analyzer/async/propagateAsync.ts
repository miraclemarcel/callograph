import { CallGraph } from "../core/buildCallGraph";
import { AsyncResult } from "../../../libs/types";

export function propagateAsyncRisk(
  graph: CallGraph,
  results: AsyncResult[]
): AsyncResult[] {

  const map = new Map(results.map(r => [r.id, r]));

  const reverse = new Map<string, Set<string>>();

  for (const [caller, callees] of graph.entries()) {
    for (const callee of callees) {
      if (!reverse.has(callee)) {
        reverse.set(callee, new Set());
      }
      reverse.get(callee)!.add(caller);
    }
  }

  const queue = results
    .filter(r =>
      r.issues.some(issue => issue.severity === "error")
    )
    .map(r => r.id);

  while (queue.length) {
    const unsafeId = queue.shift()!;
    const callers = reverse.get(unsafeId);
    if (!callers) continue;

    for (const callerId of callers) {
      const caller = map.get(callerId);
      if (!caller) continue;

      const alreadyMarked = caller.issues.some(
        i =>
          i.message === "Calls async-unsafe function"
      );

      if (!alreadyMarked) {
        caller.issues.push({
          message: "Calls async-unsafe function",
          severity: "error",
        });

        queue.push(callerId);
      }
    }
  }

  return Array.from(map.values());
}
