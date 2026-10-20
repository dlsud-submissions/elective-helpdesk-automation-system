import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  '.gitignore',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/ci.yml',
  '.vscode/tasks.json',
  'client/.env.example',
  'client/src/App/index.ts',
  'server/.env.example',
  'server/src/app.ts',
  'docs/resources/development-workflow.md',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

for (const envFile of ['client/.env.example', 'server/.env.example']) {
  const contents = readFileSync(envFile, 'utf8');
  if (/\b(?:AIza|sb_secret_)[A-Za-z0-9_-]{12,}/.test(contents)) {
    throw new Error(`A credential-like value was found in ${envFile}`);
  }
}

const gitignore = readFileSync('.gitignore', 'utf8');
if (
  !gitignore.includes('.env') ||
  !gitignore.includes('.env.*') ||
  !gitignore.includes('!.env.example')
) {
  throw new Error(
    'Git ignore must exclude local env files and allow env examples.'
  );
}

console.log('Repository configuration validated.');
