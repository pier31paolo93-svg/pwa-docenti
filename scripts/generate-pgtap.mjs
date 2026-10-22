import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(new URL('./integration.sql', import.meta.url), 'utf8');
const target = new URL('../supabase/tests/001_backend.test.sql', import.meta.url);
const tap = source.replace('begin;', 'begin;\ncreate extension if not exists pgtap with schema extensions;\nselect extensions.no_plan();')
  .replace('-- END_ASSERTIONS', 'select extensions.ok(passed,label) from test_support.results order by label;\nselect * from extensions.finish();');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== tap.replace(/\r\n/g, '\n')) throw new Error('Rigenerare i test pgTAP: node scripts/generate-pgtap.mjs');
} else writeFileSync(target, tap);
