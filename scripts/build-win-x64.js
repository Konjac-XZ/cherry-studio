const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function run(command, args, env) {
  const result = spawnSync(command, args, {
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function cleanupOldInstallers() {
  const packageJson = require('../package.json')
  const currentInstallerName = `Cherry-Studio-${packageJson.version}-x64-setup.exe`
  const distDir = path.resolve(__dirname, '..', 'dist')

  if (!fs.existsSync(distDir)) return

  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue

    const isX64Installer = /^Cherry-Studio-.+-x64-setup\.exe$/.test(entry.name)
    if (!isX64Installer || entry.name === currentInstallerName) continue

    const filePath = path.resolve(distDir, entry.name)
    if (path.dirname(filePath) !== distDir) {
      throw new Error(`Refusing to remove installer outside dist: ${filePath}`)
    }

    fs.rmSync(filePath, { force: true })
    console.log(`[build:win:x64] Removed old installer: ${entry.name}`)
  }
}

const localBin = path.resolve(__dirname, '..', 'node_modules', '.bin')
const env = {
  ...process.env,
  PATH: `${localBin}${path.delimiter}${process.env.PATH || ''}`,
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  CSC_LINK: '',
  CSC_KEY_PASSWORD: '',
  CSC_NAME: '',
  WIN_CSC_LINK: '',
  WIN_CSC_KEY_PASSWORD: '',
  WIN_CSC_NAME: '',
  WIN_SIGN: '',
  CHERRY_CERT_PATH: '',
  CHERRY_CERT_KEY: '',
  CHERRY_CERT_CSP: ''
}

run('dotenv', ['pnpm', 'run', 'build'], env)
run(
  'electron-builder',
  ['--win', 'nsis', '--x64', '--config.nsis.packElevateHelper=false', '--config.compression=store'],
  env
)
cleanupOldInstallers()
