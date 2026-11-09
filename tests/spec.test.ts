import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRepository } from '../packages/spec-engine/src/index.ts';
import { assertPublishable } from '../packages/agent-runtime/src/index.ts';
import type { ChangeSet } from '../packages/core/src/index.ts';
test('self specs validate', async () => { const r = await checkRepository(process.cwd()); assert.equal(r.ok,true); assert.equal(r.specs.length,3); });
test('invalid references and duplicate IDs fail', async () => {
 const dir = await mkdtemp(join(tmpdir(),'spectrum-test-'));
 try {
  await mkdir(join(dir,'.spectrum/features'),{recursive:true});
  await writeFile(join(dir,'.spectrum/config.json'),JSON.stringify({schemaVersion:1,specRoot:'features'}));
  for (const name of ['a','b']) await writeFile(join(dir,`.spectrum/features/${name}.json`),JSON.stringify({id:'SP-001',title:'Test',status:'draft',acceptance:['Works'],links:['missing.md','../../outside']}));
  const r = await checkRepository(dir); assert.equal(r.ok,false);
  for (const code of ['duplicate-id','broken-link','unsafe-link']) assert.ok(r.findings.some(f=>f.code===code));
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('approval and stale revision guards', () => {
 const c: ChangeSet = {id:'c1',baseRevision:'abc',summary:'test',edits:[{path:'.spectrum/overview.md',beforeHash:'hash',proposedText:'new'}],status:'proposed'};
 assert.throws(()=>assertPublishable(c,'abc'),/approval/);
 assert.throws(()=>assertPublishable({...c,status:'approved'},'def'),/changed/);
 assert.doesNotThrow(()=>assertPublishable({...c,status:'approved'},'abc'));
});
