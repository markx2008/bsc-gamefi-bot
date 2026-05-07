import fs from 'node:fs';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const startListenerPath = new URL('../scripts/start-listener.mjs', import.meta.url);
const startListenerSource = fs.existsSync(startListenerPath) ? fs.readFileSync(startListenerPath, 'utf8') : '';

assert.equal(packageJson.scripts.server, 'node scripts/start-listener.mjs', 'listener server script must use managed startup wrapper');
assert.match(startListenerSource, /createServer/, 'startup wrapper must expose an HTTP health server for Zeabur web services');
assert.match(startListenerSource, /process\.env\.PORT \|\| '3000'/, 'health server must bind Zeabur PORT with 3000 fallback');
assert.match(startListenerSource, /runCommand\(npmBin, \['run', 'db:init'\]\)/, 'startup wrapper must run db:init before listener');
assert.match(startListenerSource, /spawn\(nodeBin, \['dist\/server\/src\/services\/listener\.js'\]/, 'startup wrapper must start compiled listener after db:init');
assert.match(startListenerSource, /SIGTERM/, 'startup wrapper must forward SIGTERM for graceful shutdown');
