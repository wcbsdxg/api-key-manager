const { spawn } = require('child_process');
const path = require('path');

// Get the electron executable path
const electronPath = require('electron');

// Create a clean environment without ELECTRON_RUN_AS_NODE
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Spawn electron with the clean environment
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: env,
  windowsHide: false
});

child.on('close', (code) => {
  process.exit(code || 0);
});
