#!/usr/bin/env node
const { spawn } = require('child_process');

const args = ['expo', 'start', '--go', ...process.argv.slice(2)];
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_GO: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
