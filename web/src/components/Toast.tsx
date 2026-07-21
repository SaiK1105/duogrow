import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext, type ToastContextValue, type ToastTone } from './toast-context'
import './toast.css'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const DEFAULT_DURATION = 3200

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success', durationMs: number = DEFAULT_DURATION) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, tone }])
      window.setTimeout(() => dismiss(id), durationMs)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`toast toast--${t.tone}`}
            onClick={() => dismiss(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
