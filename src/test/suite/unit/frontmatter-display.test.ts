import * as assert from 'assert';
import {
  parseMarkdown,
  serializeMarkdown,
  roundTrip,
  type TipTapNode,
} from '../../../serializers/markdown-serializer';

function flattenNodeText(node: TipTapNode): string {
  if (node.text) {
    return node.text;
  }
  return (node.content ?? []).map(flattenNodeText).join('');
}

const SKILL_FIXTURE = `---
name: test-skill
description: |
  Line one
  Line two
metadata:
  surfaces:
    - ide
    - cloud
---

## Workflow

Body text.
`;

suite('frontmatter-display', () => {
  test('parseMarkdown maps leading YAML to frontmatter node, not heading', () => {
    const doc = parseMarkdown(SKILL_FIXTURE);
    assert.strictEqual(doc.content[0]?.type, 'frontmatter');
    const text = doc.content[0]?.attrs?.text as string;
    assert.ok(text.includes('name: test-skill'));
    assert.ok(text.includes('Line one'));
    const yamlAsHeading = doc.content.find(
      (n) =>
        n.type === 'heading' &&
        flattenNodeText(n).includes('name: test-skill'),
    );
    assert.strictEqual(yamlAsHeading, undefined, 'YAML must not parse as a heading');
    const workflow = doc.content.find(
      (n) => n.type === 'heading' && n.attrs?.level === 2,
    );
    assert.ok(workflow, 'body headings parse normally');
  });

  test('serializeMarkdown preserves frontmatter fences and multiline yaml', () => {
    const doc = parseMarkdown(SKILL_FIXTURE);
    const out = serializeMarkdown(doc);
    assert.ok(out.startsWith('---\n'));
    assert.ok(out.includes('name: test-skill'));
    assert.ok(out.includes('Line one'));
    assert.ok(out.includes('## Workflow'));
    const rt = roundTrip(SKILL_FIXTURE);
    assert.ok(rt.includes('name: test-skill'));
    assert.ok(rt.includes('## Workflow'));
  });

  test('hash inside frontmatter does not create document h1', () => {
    const md = '---\nname: x\n# yaml comment treated as markdown if unguarded\n---\n\nPara\n';
    const doc = parseMarkdown(md);
    assert.strictEqual(doc.content[0]?.type, 'frontmatter');
    const fm = (doc.content[0]?.attrs?.text as string) ?? '';
    assert.ok(fm.includes('# yaml comment'));
    const h1 = doc.content.find((n) => n.type === 'heading' && n.attrs?.level === 1);
    assert.strictEqual(h1, undefined);
    assert.strictEqual(doc.content[1]?.type, 'paragraph');
  });
});
