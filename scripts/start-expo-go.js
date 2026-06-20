#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const expoCli = require.resolve('expo/bin/cli');
const args = [expoCli, 'start', '--go', ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_GO: '1',
  },
  cwd: path.resolve(__dirname, '..'),
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
