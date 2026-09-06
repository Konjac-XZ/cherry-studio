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

function runNative(command, args, env) {
  const result = spawnSync(command, args, {
    env,
    shell: false,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function verifyWorkspaceBetterSqlite3(env) {
  const electronExecutable = require('electron')
  const betterSqlite3Entry = require.resolve('better-sqlite3')
  const script = `
    try {
      const Database = require(${JSON.stringify(betterSqlite3Entry)})
      const database = new Database(':memory:')
      database.close()
      console.log('[build:win:x64:test] better-sqlite3 Electron ABI verification passed')
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  `

  runNative(electronExecutable, ['-e', script], { ...env, ELECTRON_RUN_AS_NODE: '1' })
}

function verifyPackagedBetterSqlite3(env) {
  const distDir = path.resolve(__dirname, '..', 'dist')
  const packagedExecutable = path.join(distDir, 'win-unpacked', 'Cherry Studio.exe')
  const nativeModule = path.join(
    distDir,
    'win-unpacked',
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node'
  )

  if (!fs.existsSync(packagedExecutable) || !fs.existsSync(nativeModule)) {
    throw new Error(`Cannot verify packaged better-sqlite3: ${packagedExecutable} or ${nativeModule} is missing`)
  }

  const script = `
    try {
      require(${JSON.stringify(nativeModule)})
      console.log('[build:win:x64:test] Packaged better-sqlite3 ABI verification passed')
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  `

  runNative(packagedExecutable, ['-e', script], { ...env, ELECTRON_RUN_AS_NODE: '1' })
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
  CHERRY_CERT_CSP: '',
  CHERRY_WINDOWS_TEST_BUILD: '1'
}

run('dotenv', ['pnpm', 'run', 'build'], env)
run('pnpm', ['run', 'rebuild:electron'], env)
verifyWorkspaceBetterSqlite3(env)
run('electron-builder', ['--win', 'nsis', '--x64', '--config.compression=store'], env)
verifyPackagedBetterSqlite3(env)
