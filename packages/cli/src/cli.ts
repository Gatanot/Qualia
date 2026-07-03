#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// better-sqlite3 是 CJS native 模块，需要 ESM polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
Object.assign(globalThis, { __filename, __dirname });

import { readConfig } from '@gatanot/qualia_core/config';
import { createServer } from 'node:http';

const args = process.argv.slice(2);

// qualia serve — start the web server
if (args[0] === 'serve') {
  const port = parseInt(args[args.indexOf('--port') + 1] || '5173', 10) || 5173;

  // Dynamic import because @gatanot/qualia_web has a large build
  const { handler } = await import('@gatanot/qualia_web/handler');

  const server = createServer(handler);
  server.listen(port, () => {
    console.log(`Qualia Web — http://localhost:${port}`);
    console.log(`Config: ~/.qualia/config.json`);
  });
  process.exitCode = 0;
}

// qualia -p "prompt" — single-shot mode (coming soon)
else if (args[0] === '-p' || args[0] === '--prompt') {
  const prompt = args.slice(1).join(' ');
  console.log('Non-interactive mode — coming soon');
  console.log(`Prompt: ${prompt}`);
  process.exit(0);
}

// qualia — interactive TUI (coming soon)
else {
  console.log('Qualia CLI v0.1.0');
  console.log('');
  console.log('Usage:');
  console.log('  qualia               Interactive TUI (coming soon)');
  console.log('  qualia serve         Start web server');
  console.log('  qualia serve --port 8080');
  console.log('  qualia -p "prompt"   Run a single prompt');

  const config = readConfig();
  if (config.activeModel) {
    console.log(`\nActive model: ${config.activeModel}`);
  } else {
    console.log('\nNo model configured. Open http://localhost:5173/settings to add one.');
  }

  process.exit(0);
}
