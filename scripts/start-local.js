#!/usr/bin/env node
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envLocal = path.join(root, '.env.local');
const envDefault = path.join(root, '.env');

if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal });
} else if (fs.existsSync(envDefault)) {
  require('dotenv').config({ path: envDefault });
} else {
  console.warn('Warning: no .env.local or .env file found — continuing but env validation may fail.');
}

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(k => !process.env[k]);

function exitWith(errCode = 1) {
  process.exit(errCode);
}

if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  console.error('Please copy .env.example to .env.local and fill the values.');
  // do not exit automatically; allow user to override with flags
}

const args = process.argv.slice(2);
const doInstall = args.includes('--install');
const doMigrate = args.includes('--migrate');
const doOpen = args.includes('--open');

if (doInstall) {
  console.log('Running npm ci ...');
  const r = spawnSync('npm', ['ci'], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) exitWith(r.status);
}

if (doMigrate) {
  console.log('Running migrations: npm run migrate:supabase');
  const m = spawnSync('npm', ['run', 'migrate:supabase'], { stdio: 'inherit', cwd: root });
  if (m.status !== 0) exitWith(m.status);
}

console.log('Starting dev server: npm run dev');
const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', cwd: root, shell: true });

child.on('spawn', () => {
  const url = 'http://localhost:3000';
  console.log('Dev server started, open', url);
  if (doOpen) {
    const platform = process.platform;
    try {
      if (platform === 'win32') spawn('cmd', ['/c', 'start', url], { stdio: 'ignore', detached: true });
      else if (platform === 'darwin') spawn('open', [url], { stdio: 'ignore', detached: true });
      else spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
    } catch (e) {
      // ignore
    }
  }
});

child.on('exit', code => {
  console.log('Dev server exited with code', code);
  process.exit(code);
});
