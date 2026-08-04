-- Core projects table
create table if not exists public.llm_context_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  status text not null default 'active',
  priority integer not null default 3,
  area text,
  owner text,
  goals jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks / next actions
create table if not exists public.llm_context_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.llm_context_projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open',
  priority integer not null default 3,
  due_at timestamptz,
  source text,
  assigned_to text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Documents / evidence / files index
create table if not exists public.llm_context_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.llm_context_projects(id) on delete set null,
  title text not null,
  summary text,
  document_type text,
  source text,
  url text,
  file_id text,
  content text,
  date_on_document date,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contacts / institutions / people
create table if not exists public.llm_context_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.llm_context_projects(id) on delete set null,
  name text not null,
  organization text,
  role text,
  email text,
  phone text,
  relationship text,
  notes text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Events / meetings / deadlines / history timeline
create table if not exists public.llm_context_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.llm_context_projects(id) on delete set null,
  title text not null,
  description text,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  source text,
  participants text[] not null default '{}',
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_llm_context_projects_status on public.llm_context_projects(status);
create index if not exists idx_llm_context_tasks_project_id on public.llm_context_tasks(project_id);
create index if not exists idx_llm_context_tasks_status on public.llm_context_tasks(status);
create index if not exists idx_llm_context_tasks_due_at on public.llm_context_tasks(due_at);
create index if not exists idx_llm_context_documents_project_id on public.llm_context_documents(project_id);
create index if not exists idx_llm_context_contacts_project_id on public.llm_context_contacts(project_id);
create index if not exists idx_llm_context_events_project_id on public.llm_context_events(project_id);
create index if not exists idx_llm_context_events_starts_at on public.llm_context_events(starts_at);

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_llm_context_projects_updated_at on public.llm_context_projects;
create trigger trg_llm_context_projects_updated_at
before update on public.llm_context_projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_llm_context_tasks_updated_at on public.llm_context_tasks;
create trigger trg_llm_context_tasks_updated_at
before update on public.llm_context_tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_llm_context_documents_updated_at on public.llm_context_documents;
create trigger trg_llm_context_documents_updated_at
before update on public.llm_context_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_llm_context_contacts_updated_at on public.llm_context_contacts;
create trigger trg_llm_context_contacts_updated_at
before update on public.llm_context_contacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_llm_context_events_updated_at on public.llm_context_events;
create trigger trg_llm_context_events_updated_at
before update on public.llm_context_events
for each row execute function public.set_updated_at();;
