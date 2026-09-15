import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? files(fullPath) : /\.tsx$/.test(entry.name) ? [fullPath] : [];
  });
}

it('keeps JSX product text, labels and placeholders in the copy dictionary', () => {
  const violations: string[] = [];
  for (const file of ['App.tsx', ...files('src')]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isJsxText(node) && node.text.trim()) violations.push(`${file}: ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ['label', 'placeholder', 'accessibilityLabel', 'title'].includes(node.name.getText(source)) &&
        node.initializer && ts.isStringLiteral(node.initializer) && node.initializer.text.trim()) {
        violations.push(`${file}: ${node.getText(source)}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(violations).toEqual([]);
});
