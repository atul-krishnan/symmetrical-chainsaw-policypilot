export type OrgRole = "owner" | "admin" | "manager" | "learner";

export type RoleTrack = "exec" | "builder" | "general";
export type LearningFlowVersion = 1 | 2;
export type ControlRiskLevel = "low" | "medium" | "high";
export type EvidenceStatus = "queued" | "synced" | "rejected" | "stale" | "superseded";

export type PolicyDocument = {
  id: string;
  orgId: string;
  title: string;
  filePath: string;
  fileMimeType: string;
  parseStatus: "pending" | "ready" | "failed";
  parsedText: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PolicyObligation = {
  id: string;
  policyId: string;
  orgId: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  roleTrack: RoleTrack;
  createdAt: string;
};

export type LearningCampaignStatus = "draft" | "published" | "archived";

export type LearningCampaign = {
  id: string;
  orgId: string;
  name: string;
  dueAt: string | null;
  policyIds: string[];
  roleTracks: RoleTrack[];
  flowVersion: LearningFlowVersion;
  status: LearningCampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ModuleMediaEmbed = {
  id: string;
  kind: "image" | "video";
  title: string;
  caption: string;
  suggestionPrompt: string;
  assetPath: string | null;
  mimeType: string | null;
  status: "suggested" | "attached";
  order: number;
};

export type LearningModule = {
  id: string;
  campaignId: string;
  orgId: string;
  roleTrack: RoleTrack;
  title: string;
  summary: string;
  contentMarkdown: string;
  passScore: number;
  estimatedMinutes: number;
  mediaEmbeds: ModuleMediaEmbed[];
  quizNeedsRegeneration?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QuizQuestion = {
  id: string;
  moduleId: string;
  orgId: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
  createdAt: string;
};

export type AssignmentState = "assigned" | "in_progress" | "completed" | "overdue";

export type Assignment = {
  id: string;
  orgId: string;
  campaignId: string;
  moduleId: string;
  userId: string;
  state: AssignmentState;
  startedAt: string | null;
  completedAt: string | null;
  materialAcknowledgedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModuleAttempt = {
  id: string;
  orgId: string;
  moduleId: string;
  campaignId: string;
  userId: string;
  answers: number[];
  scorePct: number;
  passed: boolean;
  createdAt: string;
};

export type Attestation = {
  id: string;
  orgId: string;
  campaignId: string;
  userId: string;
  signatureName: string;
  accepted: boolean;
  checksum: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
};

export type AuditExportType = "csv" | "pdf";

export type AuditExport = {
  id: string;
  orgId: string;
  campaignId: string;
  fileType: AuditExportType;
  checksum: string;
  generatedBy: string;
  generatedAt: string;
};

export type CampaignMetrics = {
  campaignId: string;
  assignmentsTotal: number;
  assignmentsCompleted: number;
  completionRate: number;
  attestationRate: number;
  averageScore: number;
};

export type ControlFramework = {
  id: string;
  orgId: string;
  name: string;
  version: string;
  source: "template" | "custom";
  metadataJson: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Control = {
  id: string;
  orgId: string;
  frameworkId: string | null;
  code: string;
  title: string;
  description: string;
  riskLevel: ControlRiskLevel;
  metadataJson: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ControlMapping = {
  id: string;
  orgId: string;
  controlId: string;
  campaignId: string | null;
  moduleId: string | null;
  policyId: string | null;
  obligationId: string | null;
  mappingStrength: "primary" | "supporting";
  active: boolean;
  metadataJson: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EvidenceObject = {
  id: string;
  orgId: string;
  controlId: string | null;
  campaignId: string | null;
  moduleId: string | null;
  assignmentId: string | null;
  userId: string | null;
  evidenceType:
    | "material_acknowledgment"
    | "quiz_attempt"
    | "quiz_pass"
    | "attestation"
    | "campaign_export";
  evidenceStatus: EvidenceStatus;
  confidenceScore: number;
  qualityScore: number;
  checksum: string;
  sourceTable: string;
  sourceId: string;
  metadataJson: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ConnectorConfig = {
  id: string;
  orgId: string;
  provider: "vanta" | "drata";
  status: "connected" | "disconnected" | "error";
  scopes: string[];
  configJson: Record<string, unknown>;
  healthMessage: string | null;
  lastSyncAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncJob = {
  id: string;
  orgId: string;
  provider: "vanta" | "drata";
  status: "queued" | "running" | "completed" | "failed" | "partial";
  trigger: "manual" | "scheduled" | "retry";
  statsJson: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
};

export type OrgMembership = {
  orgId: string;
  orgName: string;
  role: OrgRole;
};

export type ApiErrorCode =
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "PROVIDER_ERROR"
  | "STORAGE_ERROR"
  | "DB_ERROR"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";
