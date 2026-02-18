export type OrgRole = "owner" | "admin" | "manager" | "learner";

export type RoleTrack = "exec" | "builder" | "general";

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
  status: LearningCampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export type UserProfile = {
  id: string;
  email: string;
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
