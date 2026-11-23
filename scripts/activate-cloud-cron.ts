import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'renddre2/radarsmart-br';

function main() {
  const status = execSync('gh auth status', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!status.includes('workflow')) {
    console.error('❌ O token atual do GitHub CLI (`gh`) ainda não possui o escopo `workflow`.');
    console.error('👉 Execute primeiro no terminal:\n   gh auth refresh -h github.com -s workflow\n');
    console.error('Depois rode novamente: npm.cmd run activate-cloud');
    process.exit(1);
  }

  const root = process.cwd();
  const srcWorkflow = path.join(root, 'config', 'workflows', 'autonomous-radar.yml');
  const dstDir = path.join(root, '.github', 'workflows');
  const dstWorkflow = path.join(dstDir, 'autonomous-radar.yml');

  fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(srcWorkflow, dstWorkflow);

  execFileSync('git', ['add', '.github/workflows/autonomous-radar.yml'], { cwd: root, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', 'ci: enable autonomous 6h GitHub Actions workflow'], {
    cwd: root,
    stdio: 'inherit',
  });
  execFileSync('git', ['push', 'origin', 'main'], { cwd: root, stdio: 'inherit' });

  execFileSync(
    'gh',
    ['api', '-X', 'PUT', `repos/${REPO}/pages`, '-f', 'build_type=workflow'],
    { cwd: root, stdio: 'inherit' },
  );

  console.log('✅ Cron automático de 6 em 6h e deploy via GitHub Actions ativados na nuvem!');
}

main();
