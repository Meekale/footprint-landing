const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const python = process.platform === 'win32'
  ? path.join(root, '.venv', 'Scripts', 'python.exe')
  : path.join(root, '.venv', 'bin', 'python');
if (!fs.existsSync(python)) {
  console.error('Set up the Python environment first; see README.md.');
  process.exit(1);
}
fs.mkdirSync(path.join(root, '.expo'), { recursive: true });
const token = crypto.randomBytes(32).toString('hex');
fs.writeFileSync(path.join(root, '.expo', 'analysis-token'), token, { mode: 0o600 });
const env = { ...process.env, SCAN_API_TOKEN: token, EXPO_PUBLIC_SCAN_TOKEN: token };
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
function launch(command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
  return child;
}
function health() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:8765/health', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(res.statusCode === 200 && JSON.parse(body).hand_model_ready); }
        catch { resolve(false); }
      });
    });
    req.setTimeout(1000, () => req.destroy());
    req.on('error', () => resolve(false));
  });
}
(async () => {
  // Refuse to reuse an unknown service or silently switch the app to another session.
  if (await health()) throw new Error('Port 8765 is already serving analysis. Stop the previous app session first.');
  launch(python, ['-m', 'uvicorn', 'algorithm.api:app', '--host', '127.0.0.1', '--port', '8765', '--no-access-log']);
  let ready = false;
  for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
    if (await health()) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready || stopping) throw new Error('Analysis could not start. Check Python packages and the downloaded hand model.');
  console.log('Python analysis ready. Images are processed in memory.');
  const expo = require.resolve('expo/bin/cli');
  const requested = process.argv.slice(2);
  const args = requested.includes('--tunnel') ? ['--tunnel', 'ngrok'] : requested;
  launch(process.execPath, [expo, 'start', ...args]);
})().catch(error => { console.error(error.message); stop(1); });
