import ts from "typescript";
import {
  FunctionNode,
  AsyncResult,
} from "../../../libs/types";
import { analyzeFunctionAsync } from "./asyncFlow";

export function analyzeAsync(
  program: ts.Program,
  functions: FunctionNode[]
): AsyncResult[] {

  const results: AsyncResult[] = [];

  for (const fn of functions) {
    const sf = fn.node.getSourceFile();
    const { line, character } =
      sf.getLineAndCharacterOfPosition(fn.node.getStart());

    const analysis = analyzeFunctionAsync(fn, program);

    results.push({
      id: fn.id,
      name: fn.name,
      file: fn.file,
      line: line + 1,
      character: character + 1,
      issues: analysis.issues,
    });
  }

  return results;
}
