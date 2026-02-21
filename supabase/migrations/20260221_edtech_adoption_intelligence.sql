alter table public.evidence_objects
  add column if not exists lineage_hash text,
  add column if not exists superseded_by_evidence_id uuid references public.evidence_objects(id) on delete set null;

update public.evidence_objects
set lineage_hash = checksum
where lineage_hash is null;

create table if not exists public.control_freshness_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  freshness_state text not null check (freshness_state in ('fresh', 'aging', 'stale', 'critical')),
  freshness_score numeric(5,2) not null check (freshness_score >= 0 and freshness_score <= 100),
  fresh_evidence_count int not null default 0,
  stale_evidence_count int not null default 0,
  rejected_evidence_count int not null default 0,
  synced_evidence_count int not null default 0,
  median_ack_hours numeric(10,2),
  last_policy_update_at timestamptz,
  latest_evidence_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create table if not exists public.adoption_edges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  edge_type text not null check (edge_type in (
    'obligation_control',
    'control_campaign',
    'control_module',
    'control_outcome',
    'control_freshness'
  )),
  policy_id uuid references public.policy_documents(id) on delete set null,
  obligation_id uuid references public.policy_obligations(id) on delete set null,
  control_id uuid references public.controls(id) on delete set null,
  campaign_id uuid references public.learning_campaigns(id) on delete set null,
  module_id uuid references public.learning_modules(id) on delete set null,
  evidence_object_id uuid references public.evidence_objects(id) on delete set null,
  freshness_snapshot_id uuid references public.control_freshness_snapshots(id) on delete set null,
  role_track text check (role_track in ('exec', 'builder', 'general')),
  weight numeric(5,2) not null default 1,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.intervention_recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  campaign_id uuid references public.learning_campaigns(id) on delete set null,
  module_id uuid references public.learning_modules(id) on delete set null,
  recommendation_type text not null check (recommendation_type in (
    'reminder_cadence',
    'role_refresher_module',
    'manager_escalation',
    'attestation_refresh'
  )),
  status text not null check (status in (
    'proposed',
    'approved',
    'executing',
    'completed',
    'dismissed'
  )) default 'proposed',
  rationale text not null,
  expected_impact_pct numeric(5,2) not null default 0,
  confidence_score numeric(5,4) not null default 0.7,
  metadata_json jsonb not null default '{}'::jsonb,
  proposed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intervention_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  intervention_id uuid not null references public.intervention_recommendations(id) on delete cascade,
  execution_status text not null check (execution_status in ('queued', 'running', 'completed', 'failed')) default 'queued',
  idempotency_key text not null,
  result_json jsonb not null default '{}'::jsonb,
  error_message text,
  executed_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, intervention_id, idempotency_key)
);

create table if not exists public.evidence_lineage_links (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_evidence_id uuid not null references public.evidence_objects(id) on delete cascade,
  target_evidence_id uuid not null references public.evidence_objects(id) on delete cascade,
  relation_type text not null check (relation_type in ('derived_from', 'supersedes', 'exported_in')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, source_evidence_id, target_evidence_id, relation_type)
);

create table if not exists public.benchmark_cohorts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null default '',
  min_sample_size int not null default 20,
  active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.benchmark_cohorts (code, label, description, min_sample_size, active, metadata_json)
values
  (
    'mid_market_saas',
    'Mid-market SaaS',
    'B2B SaaS organizations with 200-2000 employees.',
    20,
    true,
    '{"segment":"saas","sizeBand":"mid-market"}'::jsonb
  ),
  (
    'regulated_enterprise',
    'Regulated Enterprise',
    'Enterprise organizations with strict regulatory obligations.',
    30,
    true,
    '{"segment":"regulated","sizeBand":"enterprise"}'::jsonb
  ),
  (
    'ai_native_startup',
    'AI-native Startup',
    'High-growth product teams with heavy internal and external AI usage.',
    15,
    true,
    '{"segment":"ai-native","sizeBand":"startup"}'::jsonb
  )
on conflict (code) do nothing;

create table if not exists public.benchmark_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  cohort_id uuid not null references public.benchmark_cohorts(id) on delete cascade,
  metric_name text not null check (metric_name in (
    'control_freshness',
    'time_to_ack_hours',
    'stale_controls_ratio'
  )),
  metric_value numeric(10,4) not null,
  percentile_rank numeric(5,2),
  band_label text,
  sample_size int not null default 0,
  window_days int not null default 30,
  anonymized boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (anonymized = true and org_id is null)
    or
    (anonymized = false and org_id is not null)
  )
);

create index if not exists control_freshness_org_control_idx
on public.control_freshness_snapshots (org_id, control_id, computed_at desc);
create index if not exists control_freshness_org_state_idx
on public.control_freshness_snapshots (org_id, freshness_state, computed_at desc);
create index if not exists adoption_edges_org_idx
on public.adoption_edges (org_id, edge_type, created_at desc);
create index if not exists intervention_recommendations_org_status_idx
on public.intervention_recommendations (org_id, status, created_at desc);
create index if not exists intervention_recommendations_org_control_idx
on public.intervention_recommendations (org_id, control_id, status, created_at desc);
create index if not exists intervention_executions_org_intervention_idx
on public.intervention_executions (org_id, intervention_id, created_at desc);
create index if not exists evidence_lineage_org_source_idx
on public.evidence_lineage_links (org_id, source_evidence_id, created_at desc);
create index if not exists evidence_lineage_org_target_idx
on public.evidence_lineage_links (org_id, target_evidence_id, created_at desc);
create index if not exists evidence_objects_org_superseded_idx
on public.evidence_objects (org_id, superseded_by_evidence_id);
create index if not exists benchmark_metric_snapshots_cohort_metric_idx
on public.benchmark_metric_snapshots (cohort_id, metric_name, snapshot_at desc);
create index if not exists benchmark_metric_snapshots_org_metric_idx
on public.benchmark_metric_snapshots (org_id, metric_name, snapshot_at desc);

alter table public.control_freshness_snapshots enable row level security;
alter table public.adoption_edges enable row level security;
alter table public.intervention_recommendations enable row level security;
alter table public.intervention_executions enable row level security;
alter table public.evidence_lineage_links enable row level security;
alter table public.benchmark_cohorts enable row level security;
alter table public.benchmark_metric_snapshots enable row level security;

drop policy if exists "Freshness snapshots visible to members" on public.control_freshness_snapshots;
create policy "Freshness snapshots visible to members"
on public.control_freshness_snapshots
for select
using (public.is_org_member(org_id));

drop policy if exists "Freshness snapshots managed by admins" on public.control_freshness_snapshots;
create policy "Freshness snapshots managed by admins"
on public.control_freshness_snapshots
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Adoption edges visible to members" on public.adoption_edges;
create policy "Adoption edges visible to members"
on public.adoption_edges
for select
using (public.is_org_member(org_id));

drop policy if exists "Adoption edges managed by admins" on public.adoption_edges;
create policy "Adoption edges managed by admins"
on public.adoption_edges
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Interventions visible to members" on public.intervention_recommendations;
create policy "Interventions visible to members"
on public.intervention_recommendations
for select
using (public.is_org_member(org_id));

drop policy if exists "Interventions managed by admins" on public.intervention_recommendations;
create policy "Interventions managed by admins"
on public.intervention_recommendations
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Intervention executions visible to members" on public.intervention_executions;
create policy "Intervention executions visible to members"
on public.intervention_executions
for select
using (public.is_org_member(org_id));

drop policy if exists "Intervention executions managed by admins" on public.intervention_executions;
create policy "Intervention executions managed by admins"
on public.intervention_executions
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Evidence lineage visible to members" on public.evidence_lineage_links;
create policy "Evidence lineage visible to members"
on public.evidence_lineage_links
for select
using (public.is_org_member(org_id));

drop policy if exists "Evidence lineage inserted by admins" on public.evidence_lineage_links;
create policy "Evidence lineage inserted by admins"
on public.evidence_lineage_links
for insert
with check (public.is_org_admin(org_id));

drop policy if exists "Benchmark cohorts visible to authenticated users" on public.benchmark_cohorts;
create policy "Benchmark cohorts visible to authenticated users"
on public.benchmark_cohorts
for select
using (auth.uid() is not null);

drop policy if exists "Benchmark metrics visible to members or anonymized" on public.benchmark_metric_snapshots;
create policy "Benchmark metrics visible to members or anonymized"
on public.benchmark_metric_snapshots
for select
using (
  (org_id is not null and public.is_org_member(org_id))
  or
  (org_id is null and anonymized = true)
);

drop policy if exists "Benchmark metrics managed by admins" on public.benchmark_metric_snapshots;
create policy "Benchmark metrics managed by admins"
on public.benchmark_metric_snapshots
for all
using (org_id is not null and public.is_org_admin(org_id))
with check (org_id is not null and public.is_org_admin(org_id));
