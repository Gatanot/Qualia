#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// better-sqlite3 是 CJS native 模块，需要 ESM polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
Object.assign(globalThis, { __filename, __dirname });

import { register, dispatch } from './commands/index.js';
import { chatCommand } from './commands/chat.js';
import { promptCommand } from './commands/prompt.js';
import { serveCommand } from './commands/serve.js';
import { modelCommand } from './commands/model.js';

register(chatCommand);
register(promptCommand);
register(serveCommand);
register(modelCommand);

const exitCode = await dispatch(process.argv.slice(2));
process.exit(exitCode);
