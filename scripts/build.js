process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--openssl-legacy-provider'].filter(Boolean).join(' ');
process.env.PUBLIC_URL = '';
const { spawnSync } = require('child_process');
const result = spawnSync(process.execPath, [require.resolve('react-scripts/scripts/build')], { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status || 1);
require('fs').copyFileSync('build/index.html', 'build/404.html');
