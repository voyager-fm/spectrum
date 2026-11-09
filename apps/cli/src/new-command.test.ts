import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkRepository } from '@spectrum/spec-engine';
import { loadTemplate, renderTemplate } from '@spectrum/spec-engine/templates';
import { createDraft, describeDraft, readTemplateValues } from './new-command.ts';

const featureValues = {
  category_key: 'NOTES',
  category_title: 'Notes',
  feature_id: 'NOTES-007',
  interaction_id: 'NOTES-007-open',
  feature_title: 'Open a note 📘',
  interaction_title: 'Open note',
  summary: 'Read a "quoted" note\nwith café and 한글.',
  structure_key: 'notes.viewer',
  intent: 'Read the selected note.',
  trigger: 'Select "Open" for a note.',
  preconditions: 'A readable note is selected.',
  expected_outcome: 'The selected note is visible.',
  state_changes: 'The viewer retains the selected note after a failed read.',
  feedback: 'Show "Unable to open note" on failure.',
  failure_handling: 'Preserve selection and offer "Retry".',
  acceptance_criterion: 'Given a readable note, when Open is selected, then the note is visible.',
  permissions: 'Read permission for the selected note.',
  observability: 'Not applicable — no additional analytics requirement.',
  contract_id: 'notes.reading',
  object_key: 'note',
  object_definition: 'A saved note.',
  policy: 'Keep "selection" on failure.\nDo not infer success. Café 📘.',
  initial_state: 'idle',
  result_state: 'ready',
  read_state: 'idle',
  write_state: 'ready',
  happy_path: '1. Select a note.\n2. Open it.\n3. Display its content.',
  alternate_paths: 'On read failure, retain selection and offer Retry.',
};

const adrValues = {
  platform: 'common',
  decision_month: '2026-11',
  article_key: '2026-11-09-note-reading',
  article_title: 'Note reading ownership',
  decision_date: '2026-11-09',
  engineering_context: 'A note reader needs one owner for selection.',
  engineering_decision: 'Propose that the reader owns selection.',
  engineering_consequences: 'Selection can survive a failed read.',
  engineering_alternatives_considered: 'Resetting selection would discard context.',
  engineering_canonical_traceability: 'TBD — product owner must review the proposal.',
  engineering_engineering_scope: 'Note reading only.',
  engineering_verification: 'Not run — draft proposal.',
  engineering_sources: 'TBD — source inspection has not been performed.',
  engineering_open_questions: 'TBD — confirm selection lifetime.',
};

async function fixture(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'spectrum-new-draft-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function store(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

test('practical aliases and explicit catalog IDs use exactly the canonical renderer', async () => {
  await fixture(async (root) => {
    for (const [kind, id, values] of [
      ['interaction', 'feature.interaction', featureValues],
      ['contract', 'feature.contract', featureValues],
      ['flow', 'feature.flow', featureValues],
      ['adr', 'engineering.adr', adrValues],
      [
        'repository.overview',
        'repository.overview',
        { project_name: 'Notes', product_intent: 'Read notes.', product_scope: 'Local reading.' },
      ],
      ['feature.interaction', 'feature.interaction', featureValues],
    ] as const) {
      const result = await createDraft(root, kind, { values, dryRun: true });
      assert.deepEqual(result.templates, [id]);
      assert.deepEqual(result.files, [await renderTemplate(id, values)]);
      assert.equal(result.ok, true);
      assert.equal(result.check, null);
      assert.deepEqual(result.created, []);
    }
    assert.deepEqual(await readdir(root), []);
    await assert.rejects(
      createDraft(root, 'schema.config', { values: {}, dryRun: true }),
      /Unknown specification template/,
    );
  });
});

test('draft description exposes canonical content and required values without a customer root', async () => {
  const description = await describeDraft('feature');
  assert.equal(description.writes, false);
  assert.deepEqual(
    description.templates.map((template) => template.id),
    ['feature.interaction', 'feature.contract', 'feature.flow'],
  );
  assert.ok(description.requiredValues.includes('interaction_id'));
  assert.ok(description.requiredValues.includes('policy'));
  assert.equal(new Set(description.requiredValues).size, description.requiredValues.length);
  for (const template of description.templates)
    assert.deepEqual(template, await loadTemplate(template.id));
  assert.deepEqual((await describeDraft('feature.interaction')).templates, [
    await loadTemplate('feature.interaction'),
  ]);
  await assert.rejects(describeDraft('../outside'), /Unknown specification template/);
});

test('single draft creates exact planned bytes and refuses to overwrite even identical content', async () => {
  await fixture(async (root) => {
    const result = await createDraft(root, 'interaction', { values: featureValues });
    const expected = await renderTemplate('feature.interaction', featureValues);
    assert.deepEqual(result.files, [expected]);
    assert.deepEqual(result.created, [expected.path]);
    assert.deepEqual(await readFile(join(root, expected.path)), Buffer.from(expected.content));
    const again = await createDraft(root, 'interaction', { values: featureValues });
    assert.equal(again.ok, false);
    assert.deepEqual(again.conflicts, [expected.path]);
    assert.deepEqual(again.created, []);
    assert.deepEqual(await readFile(join(root, expected.path)), Buffer.from(expected.content));
  });
});

test('feature is the three-file draft bundle and preserves related links without synthesizing inventories', async () => {
  await fixture(async (root) => {
    const result = await createDraft(root, 'feature', { values: featureValues });
    const expected = await Promise.all(
      ['feature.interaction', 'feature.contract', 'feature.flow'].map((id) =>
        renderTemplate(id, featureValues),
      ),
    );
    assert.deepEqual(result.files, expected);
    assert.deepEqual(
      result.created,
      expected.map((file) => file.path),
    );
    assert.equal(result.ok, true);
    assert.equal(result.check, null);
    assert.ok(
      result.next.some((message) => message.includes('not an approved or implemented feature')),
    );
    assert.ok(
      result.next.some((message) =>
        message.includes('does not update inventories or configuration'),
      ),
    );
    assert.ok(result.next.some((message) => message.includes('spectrum check')));
    for (const file of expected)
      assert.equal(await readFile(join(root, file.path), 'utf8'), file.content);
    await assert.rejects(lstat(join(root, '.spectrum/config.json')), { code: 'ENOENT' });
    await assert.rejects(lstat(join(root, '.spectrum/product/feature_inventory/features.tsv')), {
      code: 'ENOENT',
    });
  });
});

test('real JSON, YAML and TOML parsing preserves Unicode/escaping while missing inventory remains a finding', async () => {
  await fixture(async (root) => {
    const name = 'Notes "研究"\nCafé 📘';
    await createDraft(root, 'repository.config', { values: { project_name: name } });
    assert.equal(
      JSON.parse(await readFile(join(root, '.spectrum/config.json'), 'utf8')).name,
      name,
    );
    const result = await createDraft(root, 'feature', { values: featureValues });
    const checked = await checkRepository(root);
    assert.equal(checked.config?.name, name);
    assert.equal(
      checked.ok,
      false,
      'A draft bundle without inventory records is not a valid feature',
    );
    const interaction = checked.model.documents.find((doc) => doc.path === result.files[0].path);
    assert.ok(interaction, JSON.stringify(checked.findings));
    assert.equal(interaction.metadata.summary, featureValues.summary);
    assert.equal(interaction.metadata.document_status, 'draft');
    assert.equal(interaction.metadata.status, 'drafted');
    const contract = checked.model.documents.find((doc) => doc.path === result.files[1].path);
    assert.ok(contract, JSON.stringify(checked.findings));
    assert.deepEqual(
      { ...(contract.metadata.policy as Record<string, unknown>) },
      { behavior: featureValues.policy },
    );
    assert.deepEqual(
      { ...(contract.metadata.contract as Record<string, unknown>) },
      {
        id: featureValues.contract_id,
        category: featureValues.category_key,
        primary_object_key: featureValues.object_key,
        display_region: featureValues.structure_key,
      },
    );
    assert.ok(checked.findings.some((finding) => finding.code === 'invalid-reference'));
    assert.ok(
      !checked.findings.some((finding) =>
        ['invalid-document', 'invalid-contract', 'broken-link'].includes(finding.code),
      ),
    );
    const spec = checked.specs.find((spec) => spec.id === featureValues.interaction_id);
    assert.ok(spec);
    assert.equal(spec.status, 'draft');
    assert.equal(spec.acceptance[0].checked, false);
    assert.equal(spec.acceptance[0].verification, 'not_recorded');
    assert.equal(result.check, null, 'Creation must not pretend it ran this separate check');
  });
});

test('ADR alias retains the canonical Proposed annotation and not-run verification', async () => {
  await fixture(async (root) => {
    await createDraft(root, 'repository.config', { values: { project_name: 'Notes' } });
    const result = await createDraft(root, 'adr', { values: adrValues });
    const checked = await checkRepository(root);
    const document = checked.model.documents.find((doc) => doc.path === result.files[0].path);
    assert.ok(document);
    assert.equal(document.metadata.status, 'Proposed');
    assert.ok(document.body.includes('Not run — draft proposal.'));
    assert.ok(document.body.includes(adrValues.engineering_alternatives_considered));
    assert.ok(!document.body.includes('{{'));
  });
});

test('values files must be real JSON string maps, including unused fields', async () => {
  await fixture(async (root) => {
    const path = join(root, 'values.json');
    await writeFile(path, JSON.stringify(featureValues));
    const values = await readTemplateValues(path);
    assert.deepEqual(values, featureValues);
    const before = await readFile(path);
    const result = await createDraft(root, 'interaction', { values, dryRun: true });
    assert.equal(result.ok, true);
    assert.deepEqual(await readFile(path), before);
    assert.deepEqual(await readdir(root), ['values.json']);
    for (const source of [
      '{',
      'null',
      '[]',
      '"text"',
      '42',
      '{"field":true}',
      '{"field":{"nested":"value"}}',
      '{"field":["value"]}',
    ]) {
      await writeFile(path, source);
      await assert.rejects(readTemplateValues(path), /valid JSON|string values/);
    }
    await writeFile(path, JSON.stringify({ ...featureValues, unused: 7 }));
    await assert.rejects(readTemplateValues(path), /string values/);
    await assert.rejects(readTemplateValues(join(root, 'missing.json')), { code: 'ENOENT' });
  });
});

test('missing bundle values and invalid runtime maps fail before any output directory is created', async () => {
  await fixture(async (root) => {
    const { policy: _policy, ...incomplete } = featureValues;
    await assert.rejects(
      createDraft(root, 'feature', { values: incomplete }),
      /Missing template value: policy/,
    );
    for (const values of [
      undefined,
      null,
      [],
      'text',
      1,
      { ...featureValues, unused: false },
      new Date(),
    ]) {
      await assert.rejects(createDraft(root, 'interaction', { values }), /string values/);
    }
    await assert.rejects(
      createDraft(root, 'unknown.template', { values: {} }),
      /Unknown specification template/,
    );
    await assert.rejects(
      createDraft(root, '__proto__', { values: {} }),
      /Unknown specification template/,
    );
    assert.deepEqual(await readdir(root), []);
  });
});

test('single --out changes only the destination; catalog values and link assumptions are not rewritten', async () => {
  await fixture(async (root) => {
    const result = await createDraft(root, 'interaction', {
      values: featureValues,
      out: 'drafts/任意 note.md',
    });
    const canonical = await renderTemplate('feature.interaction', featureValues);
    assert.equal(result.files[0].path, 'drafts/任意 note.md');
    assert.equal(result.files[0].content, canonical.content);
    assert.equal(await readFile(join(root, result.files[0].path), 'utf8'), canonical.content);
    assert.ok(result.next.some((message) => message.includes('configuration/profile mappings')));
    await assert.rejects(
      createDraft(root, 'feature', { values: featureValues, out: 'drafts' }),
      /single template/,
    );
    // An override does not bypass required catalog/path values.
    await assert.rejects(
      createDraft(root, 'interaction', {
        values: { ...featureValues, category_key: '../outside' },
        out: 'safe.md',
      }),
      /Unsafe template path value/,
    );
  });
});

test('traversal, absolute and non-normalized overrides fail even during dry-run', async () => {
  await fixture(async (root) => {
    for (const out of [
      '../escape.md',
      'drafts/../../escape.md',
      '/tmp/escape.md',
      'C:\\escape.md',
      '\\\\host\\share\\escape.md',
      '',
      './draft.md',
      'a//b.md',
      'a/../b.md',
      'a/',
      'nul\0.md',
    ]) {
      await assert.rejects(
        createDraft(root, 'interaction', { values: featureValues, out, dryRun: true }),
        /repository-relative/,
      );
    }
    assert.deepEqual(await readdir(root), []);
  });
});

test('dry-run returns complete content without changing bytes or creating directories', async () => {
  await fixture(async (root) => {
    await store(root, 'notes/existing.md', 'Original 📘\r\n');
    const before = await readFile(join(root, 'notes/existing.md'));
    const result = await createDraft(root, 'feature', { values: featureValues, dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.files.length, 3);
    assert.ok(result.files.every((file) => file.content.length > 0));
    assert.deepEqual(result.created, []);
    assert.deepEqual(await readdir(root), ['notes']);
    assert.deepEqual(await readFile(join(root, 'notes/existing.md')), before);
    const collision = await createDraft(root, 'interaction', {
      values: featureValues,
      out: 'notes/existing.md',
      dryRun: true,
    });
    assert.equal(collision.ok, false);
    assert.deepEqual(collision.conflicts, ['notes/existing.md']);
    assert.deepEqual(await readFile(join(root, 'notes/existing.md')), before);
  });
});

test('a known collision at any bundle destination writes none of the other planned files', async () => {
  for (const id of ['feature.interaction', 'feature.contract', 'feature.flow']) {
    await fixture(async (root) => {
      const blocked = await renderTemplate(id, featureValues);
      await store(root, blocked.path, 'Preserve user draft 📘\r\n');
      const result = await createDraft(root, 'feature', { values: featureValues });
      assert.equal(result.ok, false);
      assert.deepEqual(result.conflicts, [blocked.path]);
      assert.deepEqual(result.created, []);
      assert.equal(await readFile(join(root, blocked.path), 'utf8'), 'Preserve user draft 📘\r\n');
      for (const file of result.files) {
        if (file.path !== blocked.path)
          await assert.rejects(lstat(join(root, file.path)), { code: 'ENOENT' });
      }
    });
  }
});

test('existing directories, ancestor files and final symlinks block creation without replacement', async () => {
  await fixture(async (root) => {
    await mkdir(join(root, 'directory.md'));
    await store(root, 'ancestor', 'not a directory');
    await store(root, 'target.md', 'User bytes');
    await symlink('target.md', join(root, 'link.md'));
    await symlink('missing.md', join(root, 'dangling.md'));
    for (const out of ['directory.md', 'ancestor/draft.md', 'link.md', 'dangling.md']) {
      const result = await createDraft(root, 'interaction', { values: featureValues, out });
      assert.equal(result.ok, false);
      assert.deepEqual(result.conflicts, [out]);
      assert.deepEqual(result.created, []);
    }
    assert.equal(await readFile(join(root, 'target.md'), 'utf8'), 'User bytes');
    assert.ok((await lstat(join(root, 'link.md'))).isSymbolicLink());
    assert.ok((await lstat(join(root, 'dangling.md'))).isSymbolicLink());
  });
});

test('internal, external and dangling ancestor symlinks block all bundle writes and dry-runs', async () => {
  await fixture(async (root) => {
    await fixture(async (outside) => {
      await mkdir(join(root, 'internal'));
      for (const [name, target] of [
        ['inside', join(root, 'internal')],
        ['outside', outside],
        ['dangling', join(outside, 'absent')],
      ]) {
        await symlink(target, join(root, name));
        for (const dryRun of [false, true]) {
          const result = await createDraft(root, 'interaction', {
            values: featureValues,
            out: `${name}/draft.md`,
            dryRun,
          });
          assert.equal(result.ok, false);
          assert.deepEqual(result.created, []);
        }
      }
      await symlink(outside, join(root, '.spectrum'));
      const bundle = await createDraft(root, 'feature', { values: featureValues });
      assert.equal(bundle.conflicts.length, 3);
      assert.deepEqual(bundle.created, []);
      assert.deepEqual(await readdir(outside), []);
      assert.deepEqual(await readdir(join(root, 'internal')), []);
    });
  });
});

test('canonical TSV-cell validation is preserved for explicit inventory template IDs', async () => {
  await fixture(async (root) => {
    await assert.rejects(
      createDraft(root, 'inventory.features.data', {
        values: { ...featureValues, feature_title: 'two\tcells' },
      }),
      /one cell/,
    );
    assert.deepEqual(await readdir(root), []);
  });
});

test('brownfield configuration and inventory bytes are preserved rather than guessed or remapped', async () => {
  await fixture(async (root) => {
    const config = `${JSON.stringify(
      {
        schema_version: 2,
        name: 'Existing notes repository',
        mode: 'proposal-only',
        canonical_source: 'git-files',
        inventories: [],
        documents: [{ kind: 'feature_bundle', root: 'existing/specifications' }],
      },
      null,
      2,
    )}\r\n`;
    const inventory = 'feature_id\tfeature_title\r\ncustomer-key\tKeep original\r\n';
    await store(root, '.spectrum/config.json', config);
    await store(root, 'existing/inventory.tsv', inventory);
    await store(root, 'existing/specifications/reference.md', '# Existing behavior\r\n');
    const result = await createDraft(root, 'feature', { values: featureValues });
    assert.deepEqual(
      result.files,
      await Promise.all(
        ['feature.interaction', 'feature.contract', 'feature.flow'].map((id) =>
          renderTemplate(id, featureValues),
        ),
      ),
    );
    assert.equal(await readFile(join(root, '.spectrum/config.json'), 'utf8'), config);
    assert.equal(await readFile(join(root, 'existing/inventory.tsv'), 'utf8'), inventory);
    assert.equal(
      await readFile(join(root, 'existing/specifications/reference.md'), 'utf8'),
      '# Existing behavior\r\n',
    );
    assert.ok(
      result.next.some((message) => message.includes('actual configuration/profile mappings')),
    );
    const checked = await checkRepository(root);
    assert.equal(
      checked.specs.length,
      0,
      'Generation does not claim unconfigured catalog output is discovered',
    );
  });
});
