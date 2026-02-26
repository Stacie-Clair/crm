-- ============================================================
-- ContractorCRM — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. CONTRACTORS TABLE
create table if not exists contractors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  trade       text not null default 'General Contractor',
  phone       text,
  email       text,
  website     text,
  rating      int default 3 check (rating between 1 and 5),
  referred_by text,
  notes       text,
  tags        text[]    default '{}',
  documents   jsonb     default '[]',  -- [{id, name, type, date, amount}]
  emails      jsonb     default '[]',  -- [{id, subject, date, summary}]
  created_at  timestamptz default now()
);

-- 2. PROJECTS TABLE
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  property    text,
  status      text not null default 'planning'
              check (status in ('planning','in-progress','completed','on-hold')),
  start_date  date,
  end_date    date,
  budget      numeric(12,2) default 0,
  spent       numeric(12,2) default 0,
  description text,
  notes       text,
  tasks       jsonb default '[]',      -- [{id, text, done}]
  created_at  timestamptz default now()
);

-- 3. PROJECT ↔ CONTRACTOR JUNCTION TABLE
create table if not exists project_contractors (
  project_id    uuid references projects(id) on delete cascade,
  contractor_id uuid references contractors(id) on delete cascade,
  primary key (project_id, contractor_id)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Each user can only see and modify their own data
-- ============================================================

alter table contractors       enable row level security;
alter table projects          enable row level security;
alter table project_contractors enable row level security;

-- Contractors: users own their rows
create policy "contractors_select" on contractors for select using (auth.uid() = user_id);
create policy "contractors_insert" on contractors for insert with check (auth.uid() = user_id);
create policy "contractors_update" on contractors for update using (auth.uid() = user_id);
create policy "contractors_delete" on contractors for delete using (auth.uid() = user_id);

-- Projects: users own their rows
create policy "projects_select" on projects for select using (auth.uid() = user_id);
create policy "projects_insert" on projects for insert with check (auth.uid() = user_id);
create policy "projects_update" on projects for update using (auth.uid() = user_id);
create policy "projects_delete" on projects for delete using (auth.uid() = user_id);

-- Project contractors: accessible if user owns the project
create policy "project_contractors_select" on project_contractors
  for select using (
    exists (select 1 from projects where id = project_id and user_id = auth.uid())
  );
create policy "project_contractors_insert" on project_contractors
  for insert with check (
    exists (select 1 from projects where id = project_id and user_id = auth.uid())
  );
create policy "project_contractors_delete" on project_contractors
  for delete using (
    exists (select 1 from projects where id = project_id and user_id = auth.uid())
  );

-- ============================================================
-- DONE! Your schema is ready.
-- ============================================================
