import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const SRC_LIB = join(SRC, 'lib');
const CORE_SRC = join(ROOT, 'packages', 'core', 'src');
const WEB_SRC = join(ROOT, 'packages', 'web', 'src');

// ── Directories in SRC_LIB that belong to core ──
const CORE_DIRS = ['agent', 'ai', 'config', 'concurrency', 'gateway', 'memory', 'server', 'storage', 'task', 'tool'];

// Standalone .ts files in SRC_LIB that belong to core (not in a subdirectory)
const CORE_STANDALONE = ['chat-confirm.ts', 'chat-steering.ts', 'markdown.ts', 'paths.ts'];

// Core modules whose $lib/xxx imports should become @gatanot/qualia_core/xxx in web
const CORE_MODULES = new Set([
  'agent', 'ai', 'config', 'concurrency', 'gateway', 'memory', 'server', 'storage', 'task', 'tool',
  'chat-confirm', 'chat-steering', 'markdown', 'paths'
]);

// Files/dirs in WEB_SRC that are hand-maintained (never overwritten by sync)
const WEB_HAND_MAINTAINED = new Set(['ambient.d.ts', 'lib/index.ts']);

// Files/dirs in CORE_SRC that are hand-maintained
const CORE_HAND_MAINTAINED = new Set(['index.ts']);

// ── Utility ──

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function walkFiles(dir, exts = ['.ts', '.svelte', '.html', '.json', '.svg', '.css']) {
  const results = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        stack.push(full);
      } else if (exts.some(e => full.endsWith(e)) || exts.length === 0) {
        results.push(full);
      }
    }
  }
  return results;
}

function gitStaged() {
  try {
    return execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { return []; }
}

function gitUnstaged() {
  try {
    return execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { return []; }
}

// ── Import Rewriting (DFA-based, no regex) ──

/**
 * DFA scanner that finds `from 'path'`, `from "path"`, `import('path')`, `import("path")`
 * in TypeScript source and calls `rewrite(path)` for each. Returns rewritten source.
 *
 * Two keyword entry points feed the same quote-collecting states:
 *   from → whitespace → quote  (import declaration)
 *   import → ( → quote         (dynamic type import)
 */
function rewriteFromPaths(content, rewrite) {
  const len = content.length;
  const out = [];
  let i = 0;

  const ST = {
    NORMAL: 0,      // scanning for 'f' or 'i'
    F: 1, FR: 2, FRO: 3, FROM: 4, FROM_WS: 5,  // "from" keyword
    I: 6, IM: 7, IMP: 8, IMPO: 9, IMPOR: 10, IMPORT: 11, IMPORT_LP: 12, // "import(" keyword
    IN_SINGLE: 13, IN_DOUBLE: 14
  };

  let state = ST.NORMAL;
  let normalStart = 0;
  let matchStart = 0;    // position of 'f' or 'i' at keyword start
  let pathStart = 0;
  let matchPrefix = '';  // "from '" or 'from "' or 'import("' or "import('"

  function flushNormalTo(end) {
    if (end > normalStart) { out.push(content.slice(normalStart, end)); }
    normalStart = end;
  }

  while (i < len) {
    const ch = content[i];

    switch (state) {
      case ST.NORMAL:
        if (ch === 'f' || ch === 'F') { from_i_start(ST.F, i); }
        else if (ch === 'i' || ch === 'I') { from_i_start(ST.I, i); }
        break;

      // ── "from" keyword ──
      case ST.F:
        if (ch === 'r' || ch === 'R') { state = ST.FR; }
        else { reset(ch); }
        break;
      case ST.FR:
        if (ch === 'o' || ch === 'O') { state = ST.FRO; }
        else { reset(ch); }
        break;
      case ST.FRO:
        if (ch === 'm' || ch === 'M') { state = ST.FROM; }
        else { reset(ch); }
        break;
      case ST.FROM:
        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { state = ST.FROM_WS; }
        else { reset(ch); }
        break;
      case ST.FROM_WS:
        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { break; }
        if (ch === "'" || ch === '"') { open_quote(ch); }
        else { reset(ch); }
        break;

      // ── "import(" keyword ──
      case ST.I:
        if (ch === 'm' || ch === 'M') { state = ST.IM; }
        else { reset(ch); }
        break;
      case ST.IM:
        if (ch === 'p' || ch === 'P') { state = ST.IMP; }
        else { reset(ch); }
        break;
      case ST.IMP:
        if (ch === 'o' || ch === 'O') { state = ST.IMPO; }
        else { reset(ch); }
        break;
      case ST.IMPO:
        if (ch === 'r' || ch === 'R') { state = ST.IMPOR; }
        else { reset(ch); }
        break;
      case ST.IMPOR:
        if (ch === 't' || ch === 'T') { state = ST.IMPORT; }
        else { reset(ch); }
        break;
      case ST.IMPORT:
        if (ch === '(') { state = ST.IMPORT_LP; }
        else { reset(ch); }
        break;
      case ST.IMPORT_LP:
        if (ch === "'" || ch === '"') { open_quote(ch); }
        else { reset(ch); }
        break;

      // ── Quote content (shared) ──
      case ST.IN_SINGLE:
        if (ch === "'") { close_quote("'"); }
        else if (ch === '\\') { i++; }
        break;
      case ST.IN_DOUBLE:
        if (ch === '"') { close_quote('"'); }
        else if (ch === '\\') { i++; }
        break;
    }

    i++;
  }

  flushNormalTo(len);
  return out.join('');

  function from_i_start(newState, pos) {
    matchStart = pos;
    state = newState;
  }

  function open_quote(q) {
    state = (q === "'") ? ST.IN_SINGLE : ST.IN_DOUBLE;
    pathStart = i + 1;
    matchPrefix = content.slice(matchStart, i + 1);
  }

  function close_quote(q) {
    flushNormalTo(matchStart);
    const originalPath = content.slice(pathStart, i);
    const newPath = rewrite(originalPath);
    out.push(matchPrefix + newPath + q);
    normalStart = i + 1;
    state = ST.NORMAL;
  }

  function reset(ch) {
    if ((ch === 'f' || ch === 'F') && state !== ST.I) { from_i_start(ST.F, i); }
    else if ((ch === 'i' || ch === 'I') && state !== ST.F) { from_i_start(ST.I, i); }
    else { state = ST.NORMAL; }
  }
}

/**
 * Core rewrite: $lib/xxx → relative .js path; ./local → ./local.js
 */
function coreRewrite(importPath, filePathInCore) {
  if (importPath.startsWith('$lib/')) {
    const rest = importPath.slice(5);
    const firstSlash = rest.indexOf('/');
    const moduleName = firstSlash === -1 ? rest : rest.slice(0, firstSlash);
    const subpath = firstSlash === -1 ? '' : rest.slice(firstSlash + 1);

    let targetPath;
    if (CORE_DIRS.includes(moduleName)) {
      targetPath = subpath
        ? join(CORE_SRC, moduleName, `${subpath}.js`)
        : join(CORE_SRC, moduleName, 'index.js');
    } else {
      targetPath = join(CORE_SRC, `${moduleName}.js`);
    }

    let rel = relative(dirname(filePathInCore), targetPath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
  }

  if (importPath.startsWith('.')) {
    const lastDot = importPath.lastIndexOf('.');
    const ext = lastDot === -1 ? '' : importPath.slice(lastDot);
    const knownExts = ['.js', '.ts', '.json', '.css', '.svelte', '.html'];
    if (!knownExts.includes(ext)) {
      return importPath + '.js';
    }
  }

  return importPath;
}

/**
 * Web rewrite: $lib/{core} → @gatanot/qualia_core/{core}; web-only $lib kept
 */
function webRewrite(importPath) {
  if (importPath.startsWith('$lib/')) {
    const rest = importPath.slice(5);
    const firstSlash = rest.indexOf('/');
    const moduleName = firstSlash === -1 ? rest : rest.slice(0, firstSlash);

    if (CORE_MODULES.has(moduleName)) {
      return '@gatanot/qualia_core/' + rest;
    }
  }
  return importPath;
}

function rewriteImportsForCore(content, filePathInCore) {
  return rewriteFromPaths(content, (path) => coreRewrite(path, filePathInCore));
}

function rewriteImportsForWeb(content) {
  return rewriteFromPaths(content, webRewrite);
}

// ── Sync Core ──

function syncCore() {
  console.log('Syncing root → packages/core/src/...');

  const synced = [];
  const skipped = [];
  let staleRemoved = 0;

  // 1. Copy core directories
  for (const dirName of CORE_DIRS) {
    const srcDir = join(SRC_LIB, dirName);
    const destDir = join(CORE_SRC, dirName);
    if (!isDir(srcDir)) { console.warn(`  WARNING: ${srcDir} not found, skipping`); continue; }

    const files = walkFiles(srcDir);
    for (const srcFile of files) {
      const relPath = relative(srcDir, srcFile);
      const destFile = join(destDir, relPath);

      if (CORE_HAND_MAINTAINED.has(relative(CORE_SRC, destFile).replace(/\\/g, '/'))) {
        skipped.push(relative(ROOT, destFile));
        continue;
      }

      ensureDir(dirname(destFile));
      let content = readFileSync(srcFile, 'utf8');
      content = rewriteImportsForCore(content, destFile);
      writeFileSync(destFile, content, 'utf8');
      synced.push(relative(ROOT, destFile));
    }
  }

  // 2. Copy standalone core files
  for (const fileName of CORE_STANDALONE) {
    const srcFile = join(SRC_LIB, fileName);
    const destFile = join(CORE_SRC, fileName);
    if (!existsSync(srcFile)) { console.warn(`  WARNING: ${srcFile} not found, skipping`); continue; }

    if (CORE_HAND_MAINTAINED.has(relative(CORE_SRC, destFile).replace(/\\/g, '/'))) {
      skipped.push(relative(ROOT, destFile));
      continue;
    }

    let content = readFileSync(srcFile, 'utf8');
    content = rewriteImportsForCore(content, destFile);
    writeFileSync(destFile, content, 'utf8');
    synced.push(relative(ROOT, destFile));
  }

  // 3. Remove stale files in core/src that no longer exist in root src/lib/
  const coreFiles = walkFiles(CORE_SRC);
  for (const coreFile of coreFiles) {
    const coreRel = relative(CORE_SRC, coreFile).replace(/\\/g, '/');

    // Skip hand-maintained
    if (CORE_HAND_MAINTAINED.has(coreRel)) continue;

    // Determine what the corresponding root file would be
    // core/src/agent/loop.ts → src/lib/agent/loop.ts
    let rootFile;
    const firstSlash = coreRel.indexOf('/');
    const topDir = firstSlash === -1 ? coreRel : coreRel.slice(0, firstSlash);

    if (CORE_DIRS.includes(topDir)) {
      rootFile = join(SRC_LIB, coreRel);
    } else if (coreRel.endsWith('.ts') && !coreRel.includes('/')) {
      // standalone file like chat-confirm.ts
      rootFile = join(SRC_LIB, coreRel);
    } else {
      // Not a tracked core file (e.g., dist leftovers) — skip cleanup
      continue;
    }

    if (!existsSync(rootFile)) {
      console.log(`  Removing stale: ${relative(ROOT, coreFile)}`);
      rmSync(coreFile);
      staleRemoved++;
    }
  }

  console.log(`  Synced ${synced.length} files, skipped ${skipped.length} (hand-maintained), removed ${staleRemoved} stale`);
  return synced;
}

// ── Sync Web ──

function shouldSyncToWeb(relPath) {
  // relPath is relative to root src/
  // We sync: app.d.ts, app.html, hooks.server.ts, lib/components/**, lib/session-store.ts,
  //          lib/theme.ts, lib/model-picker-state.svelte.ts, lib/assets/**, lib/theme/**
  //          routes/**

  const parts = relPath.replace(/\\/g, '/').split('/');

  // Route files
  if (parts[0] === 'routes') return true;

  // Top-level SvelteKit files
  if (parts.length === 1 && ['app.d.ts', 'app.html', 'hooks.server.ts'].includes(parts[0])) return true;

  // Web-only lib files (not core engine modules)
  if (parts[0] === 'lib') {
    if (parts.length < 2) return false; // lib/index.ts — handled separately

    const sub = parts[1];
    // Core engine directories → NO (they come from the npm package)
    if (CORE_DIRS.includes(sub)) return false;

    // Core standalone files → NO
    const fileName = parts[parts.length - 1];
    if (CORE_STANDALONE.includes(fileName) && parts.length === 2) return false;

    // Web-only lib files
    const webLibFiles = ['session-store.ts', 'theme.ts', 'model-picker-state.svelte.ts'];
    if (webLibFiles.includes(fileName) && parts.length === 2) return true;

    // Web directories: components, assets, theme
    if (['components', 'assets', 'theme'].includes(sub)) return true;
  }

  return false;
}

function syncWeb() {
  console.log('Syncing root → packages/web/src/...');

  const synced = [];
  const skipped = [];

  const srcFiles = walkFiles(SRC, ['.ts', '.svelte', '.html', '.json', '.svg']);

  for (const srcFile of srcFiles) {
    const relPath = relative(SRC, srcFile).replace(/\\/g, '/');

    if (!shouldSyncToWeb(relPath)) continue;

    const destFile = join(WEB_SRC, relPath);

    // Check hand-maintained
    const webRel = relative(WEB_SRC, destFile).replace(/\\/g, '/');
    if (WEB_HAND_MAINTAINED.has(webRel)) {
      skipped.push(relative(ROOT, destFile));
      continue;
    }

    ensureDir(dirname(destFile));
    let content = readFileSync(srcFile, 'utf8');

    if (srcFile.endsWith('.ts') || srcFile.endsWith('.svelte')) {
      content = rewriteImportsForWeb(content);
    }

    writeFileSync(destFile, content, 'utf8');
    synced.push(relative(ROOT, destFile));
  }

  console.log(`  Synced ${synced.length} files, skipped ${skipped.length} (hand-maintained)`);
  return synced;
}

// ── Version Check ──

function readPackageJson(pkgDir) {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
}

function checkVersions() {
  console.log('Checking version consistency...');
  const core = readPackageJson(join(ROOT, 'packages', 'core'));
  const web = readPackageJson(join(ROOT, 'packages', 'web'));
  const cli = readPackageJson(join(ROOT, 'packages', 'cli'));

  const issues = [];

  const coreVersion = core.version;
  const coreDepInWeb = web.dependencies?.['@gatanot/qualia_core'];
  const coreDepInCli = cli.dependencies?.['@gatanot/qualia_core'];

  if (coreDepInWeb && coreDepInWeb.replace('^', '') !== coreVersion) {
    issues.push(`Web depends on @gatanot/qualia_core ${coreDepInWeb} but core is ${coreVersion}`);
  }
  if (coreDepInCli && coreDepInCli.replace('^', '') !== coreVersion) {
    issues.push(`CLI depends on @gatanot/qualia_core ${coreDepInCli} but core is ${coreVersion}`);
  }

  if (issues.length) {
    console.warn('  Version inconsistencies found:');
    for (const issue of issues) console.warn(`    - ${issue}`);
  } else {
    console.log('  Versions consistent.');
  }

  return { core: coreVersion, issues };
}

function bumpAllVersions(newVersion) {
  const pkgs = ['packages/core/package.json', 'packages/web/package.json', 'packages/cli/package.json'];
  for (const pkgPath of pkgs) {
    const fullPath = join(ROOT, pkgPath);
    const pkg = JSON.parse(readFileSync(fullPath, 'utf8'));
    pkg.version = newVersion;
    writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`  Updated ${pkgPath} → ${newVersion}`);
  }

  // Update web's dependency on core
  const webPkgPath = join(ROOT, 'packages', 'web', 'package.json');
  const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
  webPkg.dependencies['@gatanot/qualia_core'] = `^${newVersion}`;
  writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2) + '\n', 'utf8');

  // Update CLI's dependency on core
  const cliPkgPath = join(ROOT, 'packages', 'cli', 'package.json');
  const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf8'));
  cliPkg.dependencies['@gatanot/qualia_core'] = `^${newVersion}`;
  writeFileSync(cliPkgPath, JSON.stringify(cliPkg, null, 2) + '\n', 'utf8');

  console.log('  Updated cross-dependencies to ^' + newVersion);
}

// ── Build & Pack ──

function buildPackage(pkgDir, name) {
  console.log(`Building ${name}...`);
  try {
    execSync('npm run build', { cwd: join(ROOT, pkgDir), stdio: 'pipe', encoding: 'utf8' });
    console.log(`  ${name} build OK`);
    return true;
  } catch (e) {
    console.error(`  ${name} build FAILED:`);
    console.error(e.stderr || e.stdout || e.message);
    return false;
  }
}

function packPackage(pkgDir, name) {
  console.log(`Packing ${name}...`);
  try {
    const output = execSync('npm pack', { cwd: join(ROOT, pkgDir), encoding: 'utf8' }).trim();
    console.log(`  ${name} → ${output}`);
    return output;
  } catch (e) {
    console.error(`  ${name} pack FAILED:`);
    console.error(e.stderr || e.stdout || e.message);
    return null;
  }
}

// ── Main Commands ──

function usage() {
  console.log(`
release.mjs — Qualia sync & release pipeline

Commands:
  sync          Sync root src/ → packages/*/src/ (with import rewriting)
  sync:core     Sync only packages/core
  sync:web      Sync only packages/web
  check         Check version consistency across packages
  bump <ver>    Bump all packages to <ver> and fix cross-deps
  build         Build all packages in order: core → web → cli
  pack          Pack all packages for local testing
  release <ver> Full pipeline: bump → sync → build → pack
  status        Show git status of packages/ (staged/unstaged changes)
`);
}

const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case 'sync':
    syncCore();
    syncWeb();
    console.log('Sync complete. Run "npm run check" to verify.');
    break;

  case 'sync:core':
    syncCore();
    console.log('Core sync complete.');
    break;

  case 'sync:web':
    syncWeb();
    console.log('Web sync complete.');
    break;

  case 'check':
    checkVersions();
    break;

  case 'bump': {
    if (!arg) { console.error('Usage: release.mjs bump <version>'); process.exit(1); }
    bumpAllVersions(arg);
    break;
  }

  case 'build': {
    checkVersions();
    let ok = true;
    ok = buildPackage('packages/core', 'core') && ok;
    ok = buildPackage('packages/web', 'web') && ok;
    ok = buildPackage('packages/cli', 'cli') && ok;
    if (!ok) { console.error('\nSome builds failed. Check output above.'); process.exit(1); }
    break;
  }

  case 'pack': {
    checkVersions();
    // Build first to ensure dist/ is fresh
    let ok = true;
    ok = buildPackage('packages/core', 'core') && ok;
    ok = buildPackage('packages/web', 'web') && ok;
    ok = buildPackage('packages/cli', 'cli') && ok;
    if (!ok) { console.error('\nBuild failed, aborting pack.'); process.exit(1); }
    packPackage('packages/core', 'core');
    packPackage('packages/web', 'web');
    packPackage('packages/cli', 'cli');
    break;
  }

  case 'release': {
    if (!arg) { console.error('Usage: release.mjs release <version>'); process.exit(1); }
    const version = arg;
    console.log(`\n=== Qualia release ${version} ===\n`);

    const dirties = [...new Set([...gitStaged(), ...gitUnstaged()])]
      .filter(f => f.startsWith('packages/') || f.startsWith('src/'));

    if (dirties.length) {
      console.warn('WARNING: Uncommitted changes in packages/ or src/:');
      for (const f of dirties) console.warn(`  ${f}`);
      console.warn('');
    }

    console.log('Step 1/4: Bump versions');
    bumpAllVersions(version);

    console.log('\nStep 2/4: Sync source');
    syncCore();
    syncWeb();

    console.log('\nStep 3/4: Build packages');
    let ok = true;
    ok = buildPackage('packages/core', 'core') && ok;
    ok = buildPackage('packages/web', 'web') && ok;
    ok = buildPackage('packages/cli', 'cli') && ok;
    if (!ok) { console.error('\nBuild failed, aborting release.'); process.exit(1); }

    console.log('\nStep 4/4: Pack');
    packPackage('packages/core', 'core');
    packPackage('packages/web', 'web');
    packPackage('packages/cli', 'cli');

    console.log(`\nRelease ${version} complete.`);
    console.log('Next: npm publish each .tgz in order: core → web → cli');
    break;
  }

  case 'status': {
    const staged = gitStaged().filter(f => f.startsWith('packages/'));
    const unstaged = gitUnstaged().filter(f => f.startsWith('packages/'));
    if (staged.length) { console.log('Staged:'); staged.forEach(f => console.log(`  ${f}`)); }
    if (unstaged.length) { console.log('Unstaged:'); unstaged.forEach(f => console.log(`  ${f}`)); }
    if (!staged.length && !unstaged.length) console.log('No changes in packages/');
    break;
  }

  default:
    usage();
    break;
}
