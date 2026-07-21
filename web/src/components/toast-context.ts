import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'warn' | 'danger' | 'info'

export interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone, durationMs?: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
