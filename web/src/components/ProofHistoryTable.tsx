import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AiStatus, AnalyticsProof, ModuleKey } from '../api/types'
import { ScreenState } from './ScreenState'
import './proof-history-table.css'

const MODULE_OPTIONS: ModuleKey[] = ['wake', 'study', 'workout', 'diet', 'tasks']
const STATUS_OPTIONS: AiStatus[] = ['pending', 'verified', 'review', 'rejected', 'error']
const PAGE_SIZE = 25

interface ProofHistoryTableProps {
  /** userId → display name, so rows can name the member without a second fetch. */
  memberNames: Record<string, string>
}

/**
 * Filterable, cursor-paged proof history. Owns its own paging state because a
 * filter change and a "Load more" are different requests against the same list;
 * hoisting that into Dashboard would couple the range selector to it for nothing.
 */
export function ProofHistoryTable({ memberNames }: ProofHistoryTableProps) {
  const [module, setModule] = useState<ModuleKey | ''>('')
  const [status, setStatus] = useState<AiStatus | ''>('')
  const [proofs, setProofs] = useState<AnalyticsProof[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const page = await api.analyticsProofs({
        limit: PAGE_SIZE,
        ...(module ? { module } : {}),
        ...(status ? { status } : {}),
      })
      setProofs(page.proofs)
      setNextCursor(page.nextCursor)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [module, status])

  useEffect(() => {
    void loadFirstPage()
  }, [loadFirstPage])

  const loadMore = async () => {
    if (!nextCursor) return
    setIsLoading(true)
    try {
      const page = await api.analyticsProofs({
        limit: PAGE_SIZE,
        cursor: nextCursor,
        ...(module ? { module } : {}),
        ...(status ? { status } : {}),
      })
      setProofs((current) => [...current, ...page.proofs])
      setNextCursor(page.nextCursor)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="proof-history">
      <div className="proof-history__filters">
        <label className="proof-history__field">
          <span className="proof-history__field-label">Module</span>
          <select
            className="proof-history__select"
            value={module}
            onChange={(event) => setModule(event.target.value as ModuleKey | '')}
          >
            <option value="">All modules</option>
            {MODULE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="proof-history__field">
          <span className="proof-history__field-label">Status</span>
          <select
            className="proof-history__select"
            value={status}
            onChange={(event) => setStatus(event.target.value as AiStatus | '')}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasError && proofs.length === 0 ? (
        <ScreenState title="Proof history is unavailable" onRetry={() => void loadFirstPage()} retrying={isLoading} />
      ) : proofs.length === 0 && !isLoading ? (
        <p className="proof-history__empty">No proofs match these filters.</p>
      ) : (
        <div className="proof-history__scroll">
          <table className="proof-history__table">
            <caption className="proof-history__caption">Proof verification history</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Member</th>
                <th scope="col">Module</th>
                <th scope="col">Status</th>
                <th scope="col">Confidence</th>
                <th scope="col">Summary</th>
              </tr>
            </thead>
            <tbody>
              {proofs.map((proof) => (
                <tr key={proof.id}>
                  <td>{proof.date}</td>
                  <td>{memberNames[proof.userId] ?? 'Unknown'}</td>
                  <td>{proof.module ?? '—'}</td>
                  <td>
                    <span className={`proof-history__status proof-history__status--${proof.status}`}>
                      {proof.status}
                    </span>
                  </td>
                  {/* Server stores confidence as a 0-100 integer, not a 0..1 float. */}
                  <td>{proof.confidence == null ? '—' : `${Math.round(proof.confidence)}%`}</td>
                  <td className="proof-history__summary">{proof.summary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <button type="button" className="btn btn--outline btn--sm" onClick={() => void loadMore()} disabled={isLoading}>
          {isLoading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
