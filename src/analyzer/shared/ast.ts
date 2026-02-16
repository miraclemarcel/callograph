import ts from "typescript";

export function isInside(node: ts.Node, container: ts.Node) {
  return node.pos >= container.pos && node.end <= container.end;
}

export function rootIdentifier(expr: ts.Expression): ts.Identifier | null {
  if (ts.isIdentifier(expr)) return expr;
  if (ts.isPropertyAccessExpression(expr)) return rootIdentifier(expr.expression);
  if (ts.isElementAccessExpression(expr)) return rootIdentifier(expr.expression);
  if (ts.isParenthesizedExpression(expr)) return rootIdentifier(expr.expression);
  return null;
}

export function isWriteOperator(kind: ts.SyntaxKind) {
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
