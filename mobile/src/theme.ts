import { useColorScheme } from 'react-native'
import type { AppointmentStage } from './lib/types'

// Tokens de design-system/vetgest/MASTER.md §2 (claro y oscuro de la app).
const light = {
  scheme: 'light' as 'light' | 'dark',
  primary: '#103d41', primaryHover: '#18555a', onPrimary: '#ffffff',
  accent: '#dbf18c', onAccent: '#103d41',
  background: '#f5f7f8', card: '#ffffff', text: '#233b40', textSecondary: '#56676b', border: '#e4e9e9',
  danger: '#a73636', dangerSoft: '#fbeaea', success: '#24663a', successSoft: '#e2f4e6',
  soft: '#eef3f3', inputBackground: '#ffffff', overlay: 'rgba(16, 61, 65, 0.45)',
}
const dark: typeof light = {
  scheme: 'dark',
  primary: '#7fd1c8', primaryHover: '#9fe0d8', onPrimary: '#0e1a1b',
  accent: '#c6e36b', onAccent: '#0e1a1b',
  background: '#0e1a1b', card: '#162426', text: '#e3eeee', textSecondary: '#9fb3b5', border: '#2a3c3e',
  danger: '#f08a7e', dangerSoft: '#3a1c19', success: '#9fdcae', successSoft: '#173226',
  soft: '#1d2f31', inputBackground: '#122022', overlay: 'rgba(0, 0, 0, 0.6)',
}
export type Theme = typeof light

/** Radio de tarjetas (18) y de botones y campos (10), MASTER §2. */
export const radius = 18
export const controlRadius = 10
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
/** Altura mínima de cualquier control táctil (pt). */
export const touch = 48
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 }

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light
}

export type Tone = { bg: string; fg: string }
// Tonos de MASTER §3: ámbar, azul, lima, teal, verde, gris, rojo.
const stageLight: Record<AppointmentStage, Tone> = {
  'Por confirmar': { bg: '#fff3d6', fg: '#7a4f00' },
  Confirmada: { bg: '#e3eefc', fg: '#1f4f8f' },
  'En sala de espera': { bg: '#eef8c9', fg: '#3a4f06' },
  'En consulta': { bg: '#dcefed', fg: '#0f4f4a' },
  Atendida: { bg: '#e2f4e6', fg: '#20603a' },
  Cancelada: { bg: '#eceff0', fg: '#515d60' },
  'No asistió': { bg: '#fbeaea', fg: '#a73636' },
}
const stageDark: Record<AppointmentStage, Tone> = {
  'Por confirmar': { bg: '#3b2e0c', fg: '#ffd88a' },
  Confirmada: { bg: '#16304f', fg: '#a9c9f5' },
  'En sala de espera': { bg: '#2e3b0e', fg: '#c6e36b' },
  'En consulta': { bg: '#123c38', fg: '#7fd1c8' },
  Atendida: { bg: '#173226', fg: '#9fdcae' },
  Cancelada: { bg: '#263234', fg: '#b9c4c6' },
  'No asistió': { bg: '#3a1c19', fg: '#f08a7e' },
}
export const stageTone = (theme: Theme, stage: AppointmentStage) => (theme.scheme === 'dark' ? stageDark : stageLight)[stage]
export const toneOf = (theme: Theme, tone: 'neutral' | 'success' | 'danger' | 'warning'): Tone => ({
  neutral: { bg: theme.soft, fg: theme.text },
  success: { bg: theme.successSoft, fg: theme.success },
  danger: { bg: theme.dangerSoft, fg: theme.danger },
  warning: stageTone(theme, 'Por confirmar'),
})[tone]

/** Cifras tabulares para horas y montos. */
export const tabular = { fontVariant: ['tabular-nums' as const] }
