#!/usr/bin/env node
/**
 * YOBO — script de logs & debug
 *
 * Usage:
 *   node scripts/debug-yobo.mjs           → audit complet + fichier log (défaut)
 *   node scripts/debug-yobo.mjs audit     → idem
 *   node scripts/debug-yobo.mjs dev       → lance `tauri dev` avec variables de debug (console)
 *   node scripts/debug-yobo.mjs all       → audit puis `tauri dev` si l’audit est OK (code 0)
 *   node scripts/debug-yobo.mjs doctor    → vérifie Node, Rust, Cargo, CLI Tauri
 *   node scripts/debug-yobo.mjs audit --full → audit + npm ls, build Vite, git (si dépôt)
 *
 * PowerShell:  .\scripts\debug-yobo.ps1  |  -Dev  |  -All  |  -Doctor  |  -Full  |  -Transcript  |  -OpenLog
 * npm:         npm run debug | debug:audit | debug:dev | debug:all | debug:doctor
 *
 * Rapports: logs/yobo-debug-<timestamp>.log (gitignore).
 *
 * Variables d’environnement utiles (surtout pour `dev`) :
 *   RUST_LOG=debug|trace|info  (défaut: debug en mode dev)
 *   RUST_BACKTRACE=full|1
 *   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS  (Windows — défaut: --remote-debugging-port=9222)
 *   TAURI_ENV_DEBUG=1
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LOGS_DIR = path.join(ROOT, 'logs')

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function ensureLogsDir() {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
}

function appendLog(file, chunk) {
  fs.appendFileSync(file, chunk, 'utf8')
}

function runCapture(logFile, title, command, args, options = {}) {
  const cwd = options.cwd ?? ROOT
  const banner = `\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}\n$ ${command} ${args.join(' ')}\n\n`
  appendLog(logFile, banner)
  process.stdout.write(banner)

  const useShell =
    options.shell ??
    (process.platform === 'win32' && (command === 'npx' || command === 'npm' || command === 'node'))

  const r = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...options.env },
    shell: useShell,
    windowsHide: true,
  })

  const out = [r.stdout, r.stderr].filter(Boolean).join('')
  appendLog(logFile, out || '(aucune sortie)\n')
  process.stdout.write(out || '')
  if (r.status !== 0) {
    const err = `\n[exit code ${r.status}]\n`
    appendLog(logFile, err)
    process.stderr.write(err)
  }
  return r.status ?? 1
}

function whichSync(cmd) {
  if (process.platform === 'win32') {
    const r = spawnSync('where.exe', [cmd], { encoding: 'utf8', windowsHide: true })
    return r.status === 0 ? (r.stdout || '').trim().split(/\r?\n/)[0] : null
  }
  const r = spawnSync('which', [cmd], { encoding: 'utf8' })
  return r.status === 0 ? (r.stdout || '').trim().split('\n')[0] : null
}

function gitBlock(logFile) {
  const gitDir = path.join(ROOT, '.git')
  if (!fs.existsSync(gitDir)) {
    const msg = '\n[git] Pas de dépôt .git — section ignorée.\n'
    appendLog(logFile, msg)
    process.stdout.write(msg)
    return
  }
  runCapture(logFile, 'Git — statut (court)', 'git', ['status', '-sb'])
  runCapture(logFile, 'Git — dernier commit', 'git', ['log', '-1', '--oneline'])
}

function doctor(logFile) {
  const lines = [
    `\n${'='.repeat(72)}\nEnvironnement (doctor)\n${'='.repeat(72)}\n`,
    `plateforme: ${process.platform} ${process.arch}`,
    `node: ${process.version}`,
    `cwd: ${ROOT}`,
    '',
  ]
  const checks = [
    ['node', 'node', ['--version']],
    ['npm', 'npm', ['--version']],
    ['rustc', 'rustc', ['--version']],
    ['cargo', 'cargo', ['--version']],
  ]
  for (const [name, cmd, args] of checks) {
    const p = whichSync(cmd)
    lines.push(`${name}: ${p ? `OK (${p})` : 'INTROUVABLE'}`)
    if (p) {
      const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false, windowsHide: true })
      lines.push(`  → ${(r.stdout || r.stderr || '').trim()}`)
    }
  }
  const tauriCli = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri')
  lines.push(`tauri CLI (local): ${fs.existsSync(tauriCli) ? tauriCli : 'non installé (npm install)'}`)
  lines.push('')
  const block = lines.join('\n')
  appendLog(logFile, block)
  process.stdout.write(block)
}

function audit(logFile, { full = false } = {}) {
  let code = 0
  doctor(logFile)

  if (full) {
    code |= runCapture(logFile, 'npm — dépendances (profondeur 0)', 'npm', ['ls', '--depth=0'])
    gitBlock(logFile)
  }

  code |= runCapture(logFile, 'TypeScript (tsc -b)', 'npx', ['tsc', '-b', '--pretty', 'false'])
  code |= runCapture(logFile, 'ESLint', 'npx', ['eslint', '.'])
  code |= runCapture(logFile, 'Rust — cargo check', 'cargo', ['check'], {
    cwd: path.join(ROOT, 'src-tauri'),
    shell: false,
  })

  const tauriDir = path.join(ROOT, 'src-tauri')
  const clipProbe = spawnSync('cargo', ['clippy', '--version'], {
    cwd: tauriDir,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (clipProbe.status === 0) {
    code |= runCapture(logFile, 'Rust — cargo clippy', 'cargo', ['clippy', '--', '-D', 'warnings'], {
      cwd: tauriDir,
      shell: false,
    })
  } else {
    const skip = '\n[clippy ignoré] Installe-le avec: rustup component add clippy\n\n'
    appendLog(logFile, skip)
    process.stdout.write(skip)
  }

  if (full) {
    code |= runCapture(logFile, 'Vite — build production', 'npx', ['vite', 'build'])
  }

  const footer = `\n${'='.repeat(72)}\nFin de l'audit — code cumulé (0 = tout OK): ${code}\nFichier: ${logFile}\n${'='.repeat(72)}\n`
  appendLog(logFile, footer)
  process.stdout.write(footer)
  return code
}

function dev() {
  const env = {
    ...process.env,
    RUST_LOG: process.env.RUST_LOG || 'debug',
    RUST_BACKTRACE: process.env.RUST_BACKTRACE || 'full',
    TAURI_ENV_DEBUG: '1',
  }
  if (process.platform === 'win32') {
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS =
      process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS || '--remote-debugging-port=9222'
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  Tauri dev — mode debug                                              ║
╠══════════════════════════════════════════════════════════════════════╣
║  • Rust:   RUST_LOG=${env.RUST_LOG}                                  ║
║  • Trace:  RUST_BACKTRACE=${env.RUST_BACKTRACE}                      ║
${process.platform === 'win32' ? '║  • WebView2: port 9222 (Chrome → chrome://inspect)                  ║\n' : ''}╠══════════════════════════════════════════════════════════════════════╣
║  Front: F12 ou Ctrl+Shift+I — Outils développeur                     ║
║  Arrêt: Ctrl+C                                                       ║
╚══════════════════════════════════════════════════════════════════════╝
`)

  const child = spawn('npx', ['tauri', 'dev'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  child.on('exit', (c) => process.exit(c ?? 0))
}

const argv = process.argv.slice(2)
const mode = (argv[0] || 'audit').toLowerCase()
const fullAudit = argv.includes('--full') || process.env.YOBO_DEBUG_FULL === '1'

if (mode === 'dev') {
  dev()
} else if (mode === 'audit' || mode === 'all') {
  ensureLogsDir()
  const logFile = path.join(LOGS_DIR, `yobo-debug-${stamp()}.log`)
  const header = `YOBO — rapport debug\nDémarré: ${new Date().toISOString()}\nMode: ${mode}${fullAudit ? ' (FULL)' : ''}\n\n`
  fs.writeFileSync(logFile, header, 'utf8')
  process.stdout.write(header)

  const auditCode = audit(logFile, { full: fullAudit })
  if (mode === 'all') {
    if (auditCode !== 0) {
      console.error('\n[debug-yobo] L’audit a signalé des erreurs — lancement de tauri dev annulé.\n')
      process.exit(auditCode)
    }
    dev()
  } else {
    process.exit(auditCode)
  }
} else if (mode === 'doctor') {
  ensureLogsDir()
  const logFile = path.join(LOGS_DIR, `yobo-doctor-${stamp()}.log`)
  const docHeader = `YOBO — doctor\nDémarré: ${new Date().toISOString()}${fullAudit ? ' (FULL)' : ''}\n\n`
  fs.writeFileSync(logFile, docHeader, 'utf8')
  process.stdout.write(docHeader)
  doctor(logFile)
  if (fullAudit) {
    runCapture(logFile, 'npm — dépendances (profondeur 0)', 'npm', ['ls', '--depth=0'])
    gitBlock(logFile)
  }
  console.log(`\nÉcrit aussi dans: ${logFile}\n`)
} else {
  console.error(`Usage: node scripts/debug-yobo.mjs [audit|dev|all|doctor]\n  reçu: ${mode}`)
  process.exit(1)
}
