import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
const version = process.env.GITHUB_SHA?.slice(0, 12) || process.env.npm_package_version || '0.1.0';

function publicValue(name, fallback = '') {
  return process.env[name] || fallback;
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(srcDir, distDir, { recursive: true });

const templatePath = path.join(srcDir, 'config', 'env.template.js');
const envPath = path.join(distDir, 'config', 'env.js');
let envFile = await readFile(templatePath, 'utf8');
envFile = envFile
  .replaceAll('__APP_ENV__', publicValue('APP_ENV', 'production'))
  .replaceAll('__APP_VERSION__', version)
  .replaceAll('__SUPABASE_URL__', publicValue('SUPABASE_URL'))
  .replaceAll('__SUPABASE_ANON_KEY__', publicValue('SUPABASE_ANON_KEY'))
  .replaceAll('__FUNCTIONS_BASE_URL__', publicValue('FUNCTIONS_BASE_URL'));

await writeFile(envPath, envFile);
await rm(path.join(distDir, 'config', 'env.template.js'), { force: true });

await cp(path.join(srcDir, 'index.html'), path.join(distDir, 'acceso.html'));
await cp(path.join(root, 'index.html'), path.join(distDir, 'index.html'));

console.log(`Built Caronte frontend into ${path.relative(root, distDir)}`);
