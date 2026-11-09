import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headingSlug, markdownView } from './markdown-view.ts';

test('markdownView separates frontmatter and keeps heading anchors unique', () => {
  const view = markdownView(
    '---\ninteraction_id: "VAL-001-check"\nstatus: implementing\n---\n\n# Check\n\n## Intent\n\nText.\n\n## Intent\n',
  );
  assert.deepEqual(view.frontmatter, [
    ['interaction_id', 'VAL-001-check'],
    ['status', 'implementing'],
  ]);
  const headings = view.blocks.filter((b) => b.type === 'heading');
  assert.deepEqual(
    headings.map((h) => [h.depth, h.text, h.slug]),
    [
      [1, 'Check', 'check'],
      [2, 'Intent', 'intent'],
      [2, 'Intent', 'intent-1'],
    ],
  );
});

test('markdownView keeps task state, inline code, links and tables as data', () => {
  const view = markdownView(
    '- [ ] **AC-1:** Use `a<b>` & [the flow](../flows/x.md#top).\n- [x] Done\n\n| Key | Value |\n|:--|--:|\n| `id` | 2 |\n',
  );
  const [list, table] = view.blocks;
  assert.equal(list?.type, 'list');
  if (list?.type !== 'list') return;
  assert.deepEqual(
    list.items.map((i) => [i.task, i.checked]),
    [
      [true, false],
      [true, true],
    ],
  );
  assert.deepEqual(list.items[0]?.children, [
    {
      type: 'paragraph',
      children: [
        { type: 'strong', children: [{ type: 'text', text: 'AC-1:' }] },
        { type: 'text', text: ' Use ' },
        { type: 'code', text: 'a<b>' },
        { type: 'text', text: ' & ' },
        { type: 'link', href: '../flows/x.md#top', children: [{ type: 'text', text: 'the flow' }] },
        { type: 'text', text: '.' },
      ],
    },
  ]);
  assert.equal(table?.type, 'table');
  if (table?.type !== 'table') return;
  assert.deepEqual(table.align, ['left', 'right']);
  assert.deepEqual(table.rows[0]?.[0], [{ type: 'code', text: 'id' }]);
});

test('markdownView keeps raw HTML as literal text and never loads images', () => {
  const view = markdownView('<script>alert(1)</script>\n\n![diagram](./d.png)\n');
  assert.deepEqual(view.blocks, [
    { type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script>' }] },
    {
      type: 'paragraph',
      children: [{ type: 'link', href: './d.png', children: [{ type: 'text', text: 'diagram' }] }],
    },
  ]);
});

test('headingSlug follows GitHub anchors', () => {
  assert.equal(headingSlug('Trigger / Entry Points'), 'trigger--entry-points');
  assert.equal(headingSlug('Edge Cases / Failure Handling'), 'edge-cases--failure-handling');
});
