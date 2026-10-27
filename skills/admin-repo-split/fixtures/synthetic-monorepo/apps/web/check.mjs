import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
if (pkg.name !== 'synthetic-web') {
  console.error('web check failed');
  process.exit(1);
}
console.log('web ok');
