import ts from "typescript";

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