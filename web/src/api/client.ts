import type {
  AuthResponse,
  AiDuoConsentResponse,
  AiGenerationResponse,
  AiSettingsResponse,
  DuoResponse,
  HealthResponse,
  InsightsResponse,
  MeResponse,
  ModuleKey,
  ModuleUpdateResponse,
  OkResponse,
  PotdBankResponse,
  PotdTodayResponse,
  PotdUploadResponse,
  ProofApplyResponse,
  ProofListResponse,
  ProofResponse,
  TodayResponse,
  WeeklyReport,
} from './types'

const TOKEN_KEY = 'duogrow.session'
const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ===== Session token (sessionStorage — per-tab, so two tabs = two users) =====
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = getToken()
  if (token) headers.set('x-session', token)
  return headers
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearToken()
    // Route back to onboarding; hash router picks this up.
    window.location.hash = '#/'
    throw new ApiError('Session expired', 401)
  }

  let body: unknown = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  return body as T
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { headers: authHeaders() })
  return handle<T>(res)
}

async function post<T>(path: string, payload?: unknown): Promise<T> {
  const headers = authHeaders({ 'Content-Type': 'application/json' })
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  })
  return handle<T>(res)
}

async function put<T>(path: string, payload?: unknown): Promise<T> {
  const headers = authHeaders({ 'Content-Type': 'application/json' })
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload ?? {}),
  })
  return handle<T>(res)
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  // NOTE: never set Content-Type here — the browser sets the multipart boundary.
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  return handle<T>(res)
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) await handle<never>(res)
}

async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(BASE + path, { headers: authHeaders() })
  if (!res.ok) await handle<never>(res)
  return res.blob()
}

// ===== Typed endpoint wrappers =====
export const api = {
  // auth / identity
  register: (name: string) => post<AuthResponse>('/auth/register', { name }),
  login: (name: string) => post<AuthResponse>('/auth/login', { name }),
  me: () => get<MeResponse>('/auth/me'),

  // duo
  createDuo: () => post<DuoResponse>('/duo', {}),
  joinDuo: (inviteCode: string) => post<DuoResponse>('/duo/join', { inviteCode }),
  getDuo: () => get<DuoResponse>('/duo'),

  // today
  today: () => get<TodayResponse>('/today'),
  updateModule: (
    module: ModuleKey,
    patch: { status?: string; value?: number; detail?: string },
  ) => put<ModuleUpdateResponse>(`/modules/${module}`, patch),

  // proofs
  uploadProof: (file: File, module?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (module) form.append('module', module)
    return postForm<ProofResponse>('/proofs', form)
  },
  applyProof: (id: string) => post<ProofApplyResponse>(`/proofs/${id}/apply`, {}),
  listProofs: () => get<ProofListResponse>('/proofs'),
  getProof: (id: string) => get<ProofResponse>(`/proofs/${id}`),
  proofFile: (id: string) => getBlob(`/proofs/${id}/file`),

  // potd
  potdToday: () => get<PotdTodayResponse>('/potd/today'),
  potdBank: () => get<PotdBankResponse>('/potd/bank'),
  potdUpload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return postForm<PotdUploadResponse>('/potd/upload', form)
  },

  // cheers
  cheer: (emoji: string, message?: string) =>
    post<OkResponse>('/cheers', message ? { emoji, message } : { emoji }),
  seenCheer: (id: string) => post<OkResponse>(`/cheers/${id}/seen`, {}),

  // insights / report
  insights: () => get<InsightsResponse>('/insights'),
  weeklyReport: () => get<WeeklyReport>('/report/weekly'),

  // AI coaching — never accepts provider keys; requests use the session header only.
  aiSettings: () => get<AiSettingsResponse>('/ai/settings'),
  updateAiSettings: (settings: Pick<AiSettingsResponse, 'personalEnabled' | 'duoEnabled'>) =>
    put<AiSettingsResponse>('/ai/settings', settings),
  updateAiDuoConsent: (enabled: boolean) => put<AiDuoConsentResponse>('/ai/duo-consent', { enabled }),
  deleteAiData: () => del('/ai/data'),
  dailyPlan: () => post<AiGenerationResponse>('/ai/daily-plan'),
  duoReflection: () => post<AiGenerationResponse>('/ai/duo-reflection'),
  potdTutor: () => post<AiGenerationResponse>('/ai/potd-tutor'),
  chat: (message: string) => post<AiGenerationResponse>('/ai/chat', { message }),

  // health
  health: () => get<HealthResponse>('/health'),
}
