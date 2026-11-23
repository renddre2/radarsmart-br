import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_URL = 'https://github.com/renddre2/radarsmart-br.git';

function main() {
  const rootDir = process.cwd();
  const outDir = path.join(rootDir, 'out');
  const tmpDeployDir = path.join(os.tmpdir(), 'radarsmart-gh-pages');

  console.log('🔨 Compilando portal estático para GitHub Pages (/radarsmart-br)...');
  const env = {
    ...process.env,
    NEXT_PUBLIC_BASE_PATH: '/radarsmart-br',
    NEXT_PUBLIC_SITE_URL: 'https://renddre2.github.io/radarsmart-br',
  };

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npmBin} run build`, { cwd: rootDir, env, stdio: 'inherit' });

  if (!fs.existsSync(outDir)) {
    throw new Error('Pasta out/ não encontrada após next build.');
  }

  fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');

  fs.rmSync(tmpDeployDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDeployDir, { recursive: true });
  fs.cpSync(outDir, tmpDeployDir, { recursive: true });

  console.log('🚀 Publicando arquivos estáticos na branch gh-pages...');
  execFileSync('git', ['init', '-b', 'gh-pages'], { cwd: tmpDeployDir, stdio: 'inherit' });
  execFileSync('git', ['config', 'user.name', 'RadarSmart Deploy'], { cwd: tmpDeployDir, stdio: 'inherit' });
  execFileSync('git', ['config', 'user.email', 'deploy@radarsmart.local'], { cwd: tmpDeployDir, stdio: 'inherit' });
  execFileSync('git', ['add', '-A'], { cwd: tmpDeployDir, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', `deploy: publish static portal (${new Date().toISOString()})`], {
    cwd: tmpDeployDir,
    stdio: 'inherit',
  });
  execFileSync('git', ['push', '--force', REPO_URL, 'gh-pages'], {
    cwd: tmpDeployDir,
    stdio: 'inherit',
  });

  fs.rmSync(tmpDeployDir, { recursive: true, force: true });
  console.log('✅ Branch gh-pages atualizada com sucesso!');
}

main();
