// Links this repo to the hosted Supabase project.
//
// The project ref is the 20-lowercase-letter ID from
// https://<ref>.supabase.co (Dashboard > Project Settings > General >
// Project ID), not the project name. It is resolved from, in order:
//   1. npm run supabase:link -- <ref>
//   2. the SUPABASE_PROJECT_REF environment variable
//   3. SUPABASE_PROJECT_REF or SUPABASE_URL in server/.env
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const REF_PATTERN = /^[a-z]{20}$/;

function readServerEnv() {
  const file = 'server/.env';
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function refFromUrl(url) {
  return /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(url ?? '')?.[1];
}

const serverEnv = readServerEnv();
const candidates = [
  ['command argument', process.argv[2]],
  [
    'SUPABASE_PROJECT_REF environment variable',
    process.env.SUPABASE_PROJECT_REF,
  ],
  ['SUPABASE_PROJECT_REF in server/.env', serverEnv.SUPABASE_PROJECT_REF],
  ['SUPABASE_URL in server/.env', refFromUrl(serverEnv.SUPABASE_URL)],
].filter(([, value]) => value);

const [source, ref] = candidates[0] ?? [];

if (!ref) {
  console.error(`No Supabase project ref found.

Find it in the Supabase Dashboard > Project Settings > General > Project ID
(it is also the subdomain of https://<ref>.supabase.co), then either:
  npm run supabase:link -- <project-ref>
or set SUPABASE_URL=https://<project-ref>.supabase.co in server/.env.`);
  process.exit(1);
}

if (!REF_PATTERN.test(ref)) {
  console.error(`"${ref}" (from ${source}) is not a Supabase project ref.
A project ref is exactly 20 lowercase letters, e.g. abcdefghijklmnopqrst.
Use the Project ID from Dashboard > Project Settings > General, not the project name.`);
  process.exit(1);
}

console.log(`Linking Supabase project ${ref} (from ${source})...`);
// The ref is validated as [a-z]{20}, so passing it through the shell is safe.
// A shell is needed on Windows to run the local supabase.cmd shim.
const result = spawnSync('supabase', ['link', '--project-ref', ref], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(`
supabase link failed. If you are not signed in to the Supabase CLI yet, run:
  npm run supabase:login
then try again. The CLI may also ask for the project's database password.`);
}
process.exit(result.status ?? 1);
