// ===== DuoGrow API contract shapes (all JSON, camelCase) =====

export type ModuleKey = 'wake' | 'study' | 'workout' | 'diet' | 'tasks'
export type ModuleStatus = 'pending' | 'done'
export type Band = 'high' | 'medium' | 'low'
export type AiStatus = 'pending' | 'verified' | 'review' | 'rejected' | 'error'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type AiFeature = 'daily_plan' | 'duo_reflection' | 'potd_tutor' | 'chat' | 'insights_explain'
export type AiMode = 'live' | 'demo' | 'disabled'
export type AiLimitReason = 'feature_quota' | 'daily_budget' | 'monthly_budget'
export type AiLimitRetry = 'tomorrow' | 'next_week' | 'next_month'

// ----- Auth / identity -----
export interface User {
  id: string
  name: string
  duoId: string | null
}

export interface DuoMember {
  id: string
  name: string
}

export interface Duo {
  id: string
  name: string
  inviteCode: string
  members: DuoMember[]
}

export interface AuthResponse {
  token: string
  user: User
}

export interface MeResponse {
  user: User
  duo: Duo | null
}

export interface DuoResponse {
  duo: Duo
}

// ----- Today snapshot -----
export interface ModuleState {
  status: ModuleStatus
  value: number | null
  target: number | null
  detail: unknown
}

export interface PotdSummary {
  status: string
  title: string
  difficulty: string
  source: string
}

export interface Snapshot {
  userId: string
  name: string
  progress: number
  modules: Record<ModuleKey, ModuleState>
  potd: PotdSummary | null
}

export interface Cheer {
  id: string
  emoji: string
  message: string
  fromName: string
}

export interface TodayResponse {
  date: string
  you: Snapshot
  partner: Snapshot | null
  duoProgress: number
  streak: number
  growthScore: number
  unseenCheers: Cheer[]
  coachMessage: string
}

export interface ModuleUpdateResponse {
  ok: boolean
  entry: {
    module: ModuleKey
    status: ModuleStatus
    value: number | null
    target: number | null
    detail: unknown
  }
}

// ----- Proofs -----
export type ProofMetrics = Record<string, string | number | boolean | null>

export interface Proof {
  id: string
  url: string
  module: string | null
  aiStatus: AiStatus
  aiConfidence: number
  band: Band
  evidence: string[]
  metrics: ProofMetrics
  coachMessage: string
  summary: string
  appliedUpdate: Record<string, unknown> | null
  createdAt: string
}

export interface ProofResponse {
  proof: Proof
}

export interface ProofListResponse {
  proofs: Proof[]
}

export interface ProofApplyResponse {
  ok: boolean
  proof: Proof
}

// ----- POTD -----
export interface PotdQuestion {
  id: string
  title: string
  body: string
  topic: string
  difficulty: Difficulty
  source: string
}

export interface PotdAssignment {
  id: string
  status: string
  question: PotdQuestion
}

export interface PotdTodayResponse {
  yours: PotdAssignment
  partners: PotdAssignment | null
}

export interface PotdBankItem {
  id: string
  title: string
  topic?: string
  difficulty?: string
  source?: string
  solved: boolean
}

export interface PotdBankResponse {
  questions: PotdBankItem[]
}

export interface PotdUploadResponse {
  added: number
  sample: unknown
}

// ----- Cheers -----
export interface OkResponse {
  ok: boolean
}

// ----- AI coaching -----
export interface AiUsage {
  remaining: number
  estimatedCostCents: number
}

export interface AiSettings {
  personalEnabled: boolean
  duoEnabled: boolean
  mutualDuoConsent: boolean
  policyVersion: string
  mode: AiMode
  dailyBudgetRemainingCents: number
  usage: Record<AiFeature, AiUsage>
}

export interface AiSettingsResponse extends AiSettings {}

export interface AiGenerationResponse {
  text: string
  mode: Exclude<AiMode, 'disabled'>
  remaining: number
  estimatedCostCents: number
}

export interface AiLimitResponse {
  error: string
  reason: AiLimitReason
  retry: AiLimitRetry
}

// ----- Insights -----
export interface Subscores {
  discipline: number
  mind: number
  health: number
  consistency: number
}

export interface Prediction {
  forUser: string
  behavior: string
  riskPercent: number
  reason: string
}

export interface InsightsResponse {
  growthScore: number
  subscores: Subscores
  prediction: Prediction
  suggestion: string
  strength: string
  weeklyVerdict: string
}

// ----- Weekly report -----
export interface WeeklyReport {
  studyTime: number
  workouts: { done: number; target: number }
  goals: { done: number; target: number }
  consistency: number
  verdict: string
}

// ----- Health -----
export interface HealthResponse {
  ok?: boolean
  status?: string
  aiMode?: string
  mode?: string
  model?: string
  demo?: boolean
}
