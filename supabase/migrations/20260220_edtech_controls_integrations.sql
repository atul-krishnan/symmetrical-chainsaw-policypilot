create table if not exists public.control_frameworks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  version text not null,
  source text not null check (source in ('template', 'custom')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name, version)
);

create table if not exists public.controls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  framework_id uuid references public.control_frameworks(id) on delete set null,
  code text not null,
  title text not null,
  description text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.control_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  campaign_id uuid references public.learning_campaigns(id) on delete cascade,
  module_id uuid references public.learning_modules(id) on delete cascade,
  policy_id uuid references public.policy_documents(id) on delete cascade,
  obligation_id uuid references public.policy_obligations(id) on delete cascade,
  mapping_strength text not null check (mapping_strength in ('primary', 'supporting')),
  active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence_objects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  control_id uuid references public.controls(id) on delete set null,
  campaign_id uuid references public.learning_campaigns(id) on delete set null,
  module_id uuid references public.learning_modules(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  evidence_type text not null check (evidence_type in (
    'material_acknowledgment',
    'quiz_attempt',
    'quiz_pass',
    'attestation',
    'campaign_export'
  )),
  evidence_status text not null check (evidence_status in (
    'queued',
    'synced',
    'rejected',
    'stale',
    'superseded'
  )) default 'queued',
  confidence_score numeric(5,4) not null default 0.8000,
  quality_score numeric(5,2) not null default 80.00,
  checksum text not null,
  source_table text not null,
  source_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('vanta', 'drata')),
  status text not null check (status in ('connected', 'disconnected', 'error')) default 'connected',
  scopes_json jsonb not null default '[]'::jsonb,
  config_json jsonb not null default '{}'::jsonb,
  health_message text,
  last_sync_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create table if not exists public.integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('vanta', 'drata')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'partial')) default 'queued',
  trigger text not null check (trigger in ('manual', 'scheduled', 'retry')) default 'manual',
  stats_json jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_sync_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  sync_job_id uuid not null references public.integration_sync_jobs(id) on delete cascade,
  provider text not null check (provider in ('vanta', 'drata')),
  evidence_object_id uuid not null references public.evidence_objects(id) on delete cascade,
  external_evidence_id text,
  status text not null check (status in ('pushed', 'accepted', 'rejected', 'stale', 'superseded')),
  message text,
  payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists control_frameworks_org_idx on public.control_frameworks (org_id, created_at desc);
create index if not exists controls_org_idx on public.controls (org_id, framework_id, created_at desc);
create index if not exists control_mappings_org_control_idx on public.control_mappings (org_id, control_id, active);
create index if not exists control_mappings_org_campaign_idx on public.control_mappings (org_id, campaign_id, active);
create index if not exists control_mappings_org_module_idx on public.control_mappings (org_id, module_id, active);
create index if not exists evidence_objects_org_idx on public.evidence_objects (org_id, created_at desc);
create index if not exists evidence_objects_org_status_idx on public.evidence_objects (org_id, evidence_status, occurred_at desc);
create index if not exists evidence_objects_org_control_idx on public.evidence_objects (org_id, control_id, occurred_at desc);
create index if not exists integration_connections_org_idx on public.integration_connections (org_id, provider);
create index if not exists integration_sync_jobs_org_idx on public.integration_sync_jobs (org_id, provider, created_at desc);
create index if not exists integration_sync_events_org_idx on public.integration_sync_events (org_id, provider, created_at desc);

alter table public.control_frameworks enable row level security;
alter table public.controls enable row level security;
alter table public.control_mappings enable row level security;
alter table public.evidence_objects enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_sync_jobs enable row level security;
alter table public.integration_sync_events enable row level security;

drop policy if exists "Control frameworks visible to members" on public.control_frameworks;
create policy "Control frameworks visible to members"
on public.control_frameworks
for select
using (public.is_org_member(org_id));

drop policy if exists "Control frameworks managed by admins" on public.control_frameworks;
create policy "Control frameworks managed by admins"
on public.control_frameworks
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Controls visible to members" on public.controls;
create policy "Controls visible to members"
on public.controls
for select
using (public.is_org_member(org_id));

drop policy if exists "Controls managed by admins" on public.controls;
create policy "Controls managed by admins"
on public.controls
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Control mappings visible to members" on public.control_mappings;
create policy "Control mappings visible to members"
on public.control_mappings
for select
using (public.is_org_member(org_id));

drop policy if exists "Control mappings managed by admins" on public.control_mappings;
create policy "Control mappings managed by admins"
on public.control_mappings
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Evidence objects visible to members" on public.evidence_objects;
create policy "Evidence objects visible to members"
on public.evidence_objects
for select
using (public.is_org_member(org_id));

drop policy if exists "Evidence objects managed by admins" on public.evidence_objects;
create policy "Evidence objects managed by admins"
on public.evidence_objects
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Integration connections visible to members" on public.integration_connections;
create policy "Integration connections visible to members"
on public.integration_connections
for select
using (public.is_org_member(org_id));

drop policy if exists "Integration connections managed by admins" on public.integration_connections;
create policy "Integration connections managed by admins"
on public.integration_connections
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Integration sync jobs visible to members" on public.integration_sync_jobs;
create policy "Integration sync jobs visible to members"
on public.integration_sync_jobs
for select
using (public.is_org_member(org_id));

drop policy if exists "Integration sync jobs managed by admins" on public.integration_sync_jobs;
create policy "Integration sync jobs managed by admins"
on public.integration_sync_jobs
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Integration sync events visible to members" on public.integration_sync_events;
create policy "Integration sync events visible to members"
on public.integration_sync_events
for select
using (public.is_org_member(org_id));

drop policy if exists "Integration sync events managed by admins" on public.integration_sync_events;
create policy "Integration sync events managed by admins"
on public.integration_sync_events
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));
