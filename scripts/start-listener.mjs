import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

let currentChild;
let listenerStarted = false;
let shuttingDown = false;

const port = Number(process.env.PORT || '3000');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeBin = process.execPath;

const healthServer = createServer((request, response) => {
  if (request.url === '/healthz' || request.url === '/') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, listenerStarted }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: 'inherit',
    });
    currentChild = child;

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      currentChild = undefined;
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited with signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function startLongRunningListener() {
  const child = spawn(nodeBin, ['dist/server/server/src/services/listener.js'], {
    env: process.env,
    stdio: 'inherit',
  });
  currentChild = child;
  listenerStarted = true;

  child.on('error', (error) => {
    console.error('🔥 [LISTENER] Failed to start listener:', error);
    process.exitCode = 1;
    shutdown();
  });

  child.on('exit', (code, signal) => {
    currentChild = undefined;
    if (shuttingDown) return;
    if (signal) {
      console.error(`🔥 [LISTENER] Listener exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  if (currentChild && !currentChild.killed) {
    currentChild.kill('SIGTERM');
  }

  healthServer.close(() => {
    process.exit(process.exitCode ?? 0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

healthServer.listen(port, '0.0.0.0', async () => {
  console.log(`🩺 [HEALTH] Listener health server listening on ${port}`);
  try {
    await runCommand(npmBin, ['run', 'db:init']);
    startLongRunningListener();
  } catch (error) {
    console.error('🔥 [STARTUP] Listener startup failed:', error);
    process.exitCode = 1;
    shutdown();
  }
});
