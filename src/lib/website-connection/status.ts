// ============================================
// Connection status — stavový automat
// ============================================

import type { ConnectionStatus, StepStatus } from '@/types/website-connection'

/** Povolené přechody stavu připojení. */
export const CONNECTION_TRANSITIONS: Record<ConnectionStatus, ConnectionStatus[]> = {
  DRAFT: ['AUDITING', 'READY', 'FAILED'],
  AUDITING: ['READY', 'FAILED'],
  READY: ['INSTALLING', 'FAILED', 'DISCONNECTED'],
  INSTALLING: ['VERIFYING', 'FAILED'],
  VERIFYING: ['CONNECTED', 'DEGRADED', 'FAILED'],
  CONNECTED: ['DEGRADED', 'DISCONNECTED'],
  DEGRADED: ['CONNECTED', 'DISCONNECTED', 'FAILED'],
  FAILED: ['READY', 'DISCONNECTED'],
  DISCONNECTED: ['READY'],
}

export function canTransition(from: ConnectionStatus, to: ConnectionStatus): boolean {
  return (CONNECTION_TRANSITIONS[from] || []).includes(to)
}

export function isTerminalStep(status: StepStatus): boolean {
  return status === 'DONE' || status === 'FAILED' || status === 'SKIPPED'
}

/** Sekvenční pořadí kroků průvodce. */
export const CONNECTION_STEPS: Array<{ key: string; label: string }> = [
  { key: 'DISCOVERY', label: 'Analýza projektu' },
  { key: 'AUDIT', label: 'Audit webu' },
  { key: 'REGISTER', label: 'Registrace webu' },
  { key: 'CONTENT_DISCOVERY', label: 'Nalezení obsahu' },
  { key: 'FORM_DISCOVERY', label: 'Nalezení formulářů' },
  { key: 'CONNECTOR_INSTALL', label: 'Instalace konektoru' },
  { key: 'CONTENT_CONNECT', label: 'Propojení obsahu' },
  { key: 'FORM_CONNECT', label: 'Propojení formulářů' },
  { key: 'TRACKING_CONNECT', label: 'Propojení sledování' },
  { key: 'VERIFY_CONTENT', label: 'Ověření obsahu' },
  { key: 'VERIFY_FORMS', label: 'Ověření formulářů' },
  { key: 'HEALTH_CHECK', label: 'Kontrola stavu' },
  { key: 'COMPLETE', label: 'Dokončení' },
]
