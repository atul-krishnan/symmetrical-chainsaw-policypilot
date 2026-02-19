import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";

type Provider = "vanta" | "drata";

type SyncStatusFilter = "queued" | "stale" | "rejected" | "synced" | "superseded";

export function maskApiKey(input: string): { hash: string; last4: string } {
  const trimmed = input.trim();
  return {
    hash: createHash("sha256").update(trimmed).digest("hex"),
    last4: trimmed.slice(-4),
  };
}

export async function runIntegrationEvidenceSync(input: {
  supabase: SupabaseClient;
  orgId: string;
  provider: Provider;
  userId: string;
  evidenceStatus: SyncStatusFilter;
  limit: number;
}): Promise<{
  syncJobId: string;
  status: "completed" | "partial";
  attempted: number;
  synced: number;
  rejected: number;
}> {
  const connectionResult = await input.supabase
    .from("integration_connections")
    .select("id,status")
    .eq("org_id", input.orgId)
    .eq("provider", input.provider)
    .single();

  if (connectionResult.error || !connectionResult.data) {
    throw new ApiError("NOT_FOUND", `No ${input.provider} connection found`, 404);
  }

  if (connectionResult.data.status !== "connected") {
    throw new ApiError("CONFLICT", `${input.provider} connection is not active`, 409);
  }

  const syncJobId = randomUUID();

  const createJob = await input.supabase.from("integration_sync_jobs").insert({
    id: syncJobId,
    org_id: input.orgId,
    provider: input.provider,
    status: "running",
    trigger: "manual",
    started_at: new Date().toISOString(),
    created_by: input.userId,
    stats_json: {},
  });

  if (createJob.error) {
    throw new ApiError("DB_ERROR", createJob.error.message, 500);
  }

  const evidenceResult = await input.supabase
    .from("evidence_objects")
    .select("id,control_id,evidence_type,evidence_status,checksum,metadata_json")
    .eq("org_id", input.orgId)
    .eq("evidence_status", input.evidenceStatus)
    .order("occurred_at", { ascending: true })
    .limit(input.limit);

  if (evidenceResult.error) {
    throw new ApiError("DB_ERROR", evidenceResult.error.message, 500);
  }

  const evidenceRows = evidenceResult.data ?? [];
  let synced = 0;
  let rejected = 0;

  for (const evidence of evidenceRows) {
    const shouldReject = !evidence.control_id;
    const externalEvidenceId = `${input.provider}:${evidence.id}`;

    const eventInsert = await input.supabase.from("integration_sync_events").insert({
      org_id: input.orgId,
      sync_job_id: syncJobId,
      provider: input.provider,
      evidence_object_id: evidence.id,
      external_evidence_id: shouldReject ? null : externalEvidenceId,
      status: shouldReject ? "rejected" : "accepted",
      message: shouldReject
        ? "Evidence is not mapped to a control"
        : "Evidence accepted by provider connector",
      payload_json: {
        evidenceType: evidence.evidence_type,
        checksum: evidence.checksum,
        metadata: evidence.metadata_json,
      },
      response_json: {
        provider: input.provider,
        simulated: true,
        accepted: !shouldReject,
      },
    });

    if (eventInsert.error) {
      throw new ApiError("DB_ERROR", eventInsert.error.message, 500);
    }

    const evidenceUpdate = await input.supabase
      .from("evidence_objects")
      .update({
        evidence_status: shouldReject ? "rejected" : "synced",
        updated_at: new Date().toISOString(),
      })
      .eq("id", evidence.id)
      .eq("org_id", input.orgId);

    if (evidenceUpdate.error) {
      throw new ApiError("DB_ERROR", evidenceUpdate.error.message, 500);
    }

    if (shouldReject) {
      rejected += 1;
    } else {
      synced += 1;
    }
  }

  const jobStatus: "completed" | "partial" = rejected > 0 ? "partial" : "completed";

  const finishJob = await input.supabase
    .from("integration_sync_jobs")
    .update({
      status: jobStatus,
      finished_at: new Date().toISOString(),
      stats_json: {
        attempted: evidenceRows.length,
        synced,
        rejected,
      },
    })
    .eq("id", syncJobId)
    .eq("org_id", input.orgId);

  if (finishJob.error) {
    throw new ApiError("DB_ERROR", finishJob.error.message, 500);
  }

  const connectionUpdate = await input.supabase
    .from("integration_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      health_message:
        jobStatus === "completed"
          ? "Sync healthy"
          : `Sync completed with ${rejected} rejected evidence object(s)`,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionResult.data.id)
    .eq("org_id", input.orgId);

  if (connectionUpdate.error) {
    throw new ApiError("DB_ERROR", connectionUpdate.error.message, 500);
  }

  return {
    syncJobId,
    status: jobStatus,
    attempted: evidenceRows.length,
    synced,
    rejected,
  };
}
