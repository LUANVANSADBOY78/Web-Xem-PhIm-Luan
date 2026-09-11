const { spawn } = require('child_process');
const server = spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '3001', DEV_ORIGIN: 'http://localhost:3000' } });
const client = spawn(process.execPath, [require.resolve('react-scripts/scripts/start')], { stdio: 'inherit', env: { ...process.env, PORT: '3000', BROWSER: 'none', NODE_OPTIONS: '--openssl-legacy-provider' } });
function stop() { server.kill(); client.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', () => client.kill());
client.on('exit', () => server.kill());
