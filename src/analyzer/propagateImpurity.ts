import { CallGraph } from "./buildCallGraph";
import { PurityResult } from "../../libs/types";

export function propagateImpurity(
  graph: CallGraph,
  purity: PurityResult[]
): PurityResult[] {

  // Map functionId -> PurityResult
  const resultMap = new Map<string, PurityResult>();
  for (const r of purity) {
    resultMap.set(r.id, r);
  }

  // Build reverse graph: calleeId -> Set<callerId>
  const reverse = new Map<string, Set<string>>();

  for (const [callerId, calleeIds] of graph.entries()) {
    for (const calleeId of calleeIds) {
      if (!reverse.has(calleeId)) {
        reverse.set(calleeId, new Set());
      }
      reverse.get(calleeId)!.add(callerId);
    }
  }

  // BFS propagation
  const queue: string[] = [];

  // Seed with initially impure functions
  for (const r of purity) {
    if (!r.isPure) {
      queue.push(r.id);
    }
  }

  while (queue.length > 0) {
    const impureId = queue.shift()!;
    const callers = reverse.get(impureId);
    if (!callers) continue;

    for (const callerId of callers) {
      const caller = resultMap.get(callerId);
      if (!caller) continue;

      if (caller.isPure) {
        caller.isPure = false;
        caller.reasons.push(`Calls impure function`);
        queue.push(callerId);
      }
    }
  }

  return Array.from(resultMap.values());
}
