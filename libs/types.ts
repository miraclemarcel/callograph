import ts from "typescript";


export type AsyncSeverity = "error" | "warning" | "info";

export interface AsyncIssue {
  message: string;
  severity: AsyncSeverity;
}

export interface AsyncResult {
  id: string;
  name: string;
  file: string;
  line: number;
  character: number;
  issues: AsyncIssue[];
}


export interface PurityResult {
  id: string;
  name: string;
  file: string;
  line: number;
  character: number;
  isPure: boolean;
  reasons: string[];
}


export interface FunctionNode {
  id: string;
  name: string;
  file: string;
  node: ts.FunctionLikeDeclaration;
}


export interface AsyncFlowState {
  returnsPromise: boolean;
  containsAwait: boolean;
  hasTryCatch: boolean;
  floatingPromises: number;
  unhandledRejections: number;
  asyncCallbacks: number;
}

// export interface AsyncResult {
//   id: string;
//   name: string;
//   file: string;
//   line: number;
//   character: number;
//   // isSafe: boolean;
//   // issues: string[];
// }
