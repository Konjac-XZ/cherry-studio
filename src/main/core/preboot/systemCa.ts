import { getCACertificates, setDefaultCACertificates } from 'node:tls'

/** Make Node TLS trust the OS certificate store in addition to its existing CAs. */
export function configureNodeSystemCa(): void {
  const certificates = new Set([...getCACertificates('default'), ...getCACertificates('system')])

  setDefaultCACertificates([...certificates])
  // Child Node processes read this during startup; changing it alone is too late
  // to reconfigure the already-running Electron main process.
  process.env.NODE_USE_SYSTEM_CA = '1'
}
