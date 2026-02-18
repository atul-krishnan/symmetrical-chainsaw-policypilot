create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'manager', 'learner')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_mime_type text not null,
  parse_status text not null check (parse_status in ('pending', 'ready', 'failed')),
  parsed_text text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_obligations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  policy_id uuid not null references public.policy_documents(id) on delete cascade,
  title text not null,
  detail text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  role_track text not null check (role_track in ('exec', 'builder', 'general')),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  due_at timestamptz,
  policy_ids jsonb not null default '[]'::jsonb,
  role_tracks jsonb not null default '["exec","builder","general"]'::jsonb,
  status text not null check (status in ('draft', 'published', 'archived')) default 'draft',
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.learning_campaigns(id) on delete cascade,
  role_track text not null check (role_track in ('exec', 'builder', 'general')),
  title text not null,
  summary text not null,
  content_markdown text not null,
  pass_score int not null check (pass_score between 60 and 100),
  estimated_minutes int not null check (estimated_minutes between 3 and 45),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  prompt text not null,
  choices_json jsonb not null,
  correct_choice_index int not null check (correct_choice_index between 0 and 3),
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.learning_campaigns(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('assigned', 'in_progress', 'completed', 'overdue')) default 'assigned',
  started_at timestamptz,
  completed_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, module_id, user_id)
);

create table if not exists public.module_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  campaign_id uuid not null references public.learning_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null,
  score_pct int not null check (score_pct between 0 and 100),
  passed boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attestations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.learning_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signature_name text not null,
  accepted boolean not null default true,
  checksum text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create table if not exists public.audit_exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.learning_campaigns(id) on delete cascade,
  file_type text not null check (file_type in ('csv', 'pdf')),
  checksum text not null,
  generated_by uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now()
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.learning_campaigns(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  recipient_email text not null,
  notification_type text not null check (notification_type in ('invite', 'reminder')),
  status text not null check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.request_audit_logs (
  id bigint generated always as identity primary key,
  request_id text not null,
  org_id uuid,
  user_id uuid,
  route text not null,
  action text not null,
  status_code int not null,
  error_code text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_org_idx on public.organization_members (org_id, role);
create index if not exists policy_documents_org_idx on public.policy_documents (org_id, created_at desc);
create index if not exists obligations_org_policy_idx on public.policy_obligations (org_id, policy_id);
create index if not exists campaigns_org_idx on public.learning_campaigns (org_id, created_at desc);
create index if not exists modules_campaign_idx on public.learning_modules (campaign_id);
create index if not exists assignments_user_state_idx on public.assignments (user_id, state, due_at);
create index if not exists attempts_campaign_user_idx on public.module_attempts (campaign_id, user_id, created_at desc);
create index if not exists attestations_campaign_idx on public.attestations (campaign_id, created_at desc);
create index if not exists audit_exports_campaign_idx on public.audit_exports (campaign_id, generated_at desc);
create index if not exists request_logs_org_idx on public.request_audit_logs (org_id, created_at desc);

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where org_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where org_id = target_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.policy_documents enable row level security;
alter table public.policy_obligations enable row level security;
alter table public.learning_campaigns enable row level security;
alter table public.learning_modules enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.assignments enable row level security;
alter table public.module_attempts enable row level security;
alter table public.attestations enable row level security;
alter table public.audit_exports enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.request_audit_logs enable row level security;

create policy if not exists "Organizations visible to members"
on public.organizations
for select
using (public.is_org_member(id));

create policy if not exists "Organization members visible to same org"
on public.organization_members
for select
using (public.is_org_member(org_id));

create policy if not exists "Organization admins manage members"
on public.organization_members
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Policies visible to members"
on public.policy_documents
for select
using (public.is_org_member(org_id));

create policy if not exists "Policies managed by admins"
on public.policy_documents
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Obligations visible to members"
on public.policy_obligations
for select
using (public.is_org_member(org_id));

create policy if not exists "Obligations managed by admins"
on public.policy_obligations
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Campaigns visible to members"
on public.learning_campaigns
for select
using (public.is_org_member(org_id));

create policy if not exists "Campaigns managed by admins"
on public.learning_campaigns
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Modules visible to members"
on public.learning_modules
for select
using (public.is_org_member(org_id));

create policy if not exists "Modules managed by admins"
on public.learning_modules
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Questions visible to members"
on public.quiz_questions
for select
using (public.is_org_member(org_id));

create policy if not exists "Questions managed by admins"
on public.quiz_questions
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Assignments visible to assignee or admins"
on public.assignments
for select
using (user_id = auth.uid() or public.is_org_admin(org_id));

create policy if not exists "Assignments managed by admins"
on public.assignments
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Attempts visible to owner or admins"
on public.module_attempts
for select
using (user_id = auth.uid() or public.is_org_admin(org_id));

create policy if not exists "Attempts insert by owner"
on public.module_attempts
for insert
with check (user_id = auth.uid());

create policy if not exists "Attestations visible to owner or admins"
on public.attestations
for select
using (user_id = auth.uid() or public.is_org_admin(org_id));

create policy if not exists "Attestations insert by owner"
on public.attestations
for insert
with check (user_id = auth.uid());

create policy if not exists "Attestations update by owner"
on public.attestations
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy if not exists "Audit exports visible to members"
on public.audit_exports
for select
using (public.is_org_member(org_id));

create policy if not exists "Audit exports managed by admins"
on public.audit_exports
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Notifications visible to members"
on public.notification_jobs
for select
using (public.is_org_member(org_id));

create policy if not exists "Notifications managed by admins"
on public.notification_jobs
for all
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

create policy if not exists "Request logs visible to admins"
on public.request_audit_logs
for select
using (public.is_org_admin(org_id));

create policy if not exists "Request logs insert for members"
on public.request_audit_logs
for insert
with check (public.is_org_member(org_id));

insert into storage.buckets (id, name, public)
values ('policy-files', 'policy-files', false)
on conflict (id) do nothing;

create policy if not exists "Policy files readable by org members"
on storage.objects
for select
using (
  bucket_id = 'policy-files'
  and public.is_org_member((storage.foldername(name))[2]::uuid)
);

create policy if not exists "Policy files writable by org admins"
on storage.objects
for insert
with check (
  bucket_id = 'policy-files'
  and public.is_org_admin((storage.foldername(name))[2]::uuid)
);

create policy if not exists "Policy files deletable by org admins"
on storage.objects
for delete
using (
  bucket_id = 'policy-files'
  and public.is_org_admin((storage.foldername(name))[2]::uuid)
);
