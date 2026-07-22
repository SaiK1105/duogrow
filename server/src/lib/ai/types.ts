export type { AiFeature, AiMode, AiSettings } from "../../types.js";

export interface AiAuditEvent {
  eventType: string;
  actorUserId: string;
  duoId: string | null;
  feature: import("../../types.js").AiFeature;
  policyVersion: string;
  createdAt: string;
}
