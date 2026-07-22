import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function usePrivateProofUrl(proofId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!proofId) {
      setUrl(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    api
      .proofFile(proofId)
      .then((file) => {
        objectUrl = URL.createObjectURL(file)
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
        } else {
          setUrl(objectUrl)
        }
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [proofId])

  return url
}
