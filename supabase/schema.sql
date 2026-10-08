-- TaskPilot AI Supabase Schema
-- Run this in your Supabase project's SQL Editor (SQL Editor -> New Query -> Run)
-- All tables are user-owned and protected by Row Level Security (RLS).

create extension if not exists pgcrypto;

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  timezone text not null default 'Asia/Kolkata',
  time_format text not null default '12h' check (time_format in ('12h', '24h')),
  notifications boolean not null default true,
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Routines
create table if not exists public.routines (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wake_time time not null default '07:00',
  sleep_time time not null default '23:00',
  focus_duration_minutes integer not null default 50 check (focus_duration_minutes between 15 and 120),
  break_minutes integer not null default 10 check (break_minutes between 5 and 60),
  buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 90),
  break_frequency integer not null default 2 check (break_frequency between 1 and 8),
  preferred_time_period text not null default 'morning' check (preferred_time_period in ('morning', 'afternoon', 'evening')),
  energy_period text not null default 'morning' check (energy_period in ('morning', 'afternoon', 'evening')),
  updated_at timestamptz not null default now()
);

-- 3. Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null default 'Personal',
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  status text not null default 'todo' check (status in ('todo', 'in-progress', 'completed')),
  duration_minutes integer not null default 50 check (duration_minutes between 5 and 1440),
  deadline date not null default current_date,
  preferred_time_period text not null default 'morning' check (preferred_time_period in ('morning', 'afternoon', 'evening')),
  steps jsonb default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Scheduled Tasks / Calendar Events
create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text,
  priority text,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  minutes integer not null default 30,
  kind text not null default 'task' check (kind in ('task', 'break', 'commitment', 'routine')),
  reason text,
  completed boolean not null default false,
  missed boolean not null default false,
  is_ai_generated boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5. Commitments (Fixed Calendar Events)
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_time time not null,
  end_time time not null,
  weekdays smallint[] not null default array[]::smallint[],
  commitment_date date,
  created_at timestamptz not null default now()
);

-- 6. Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  message text not null,
  reminder_time timestamptz not null,
  completed boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7. Focus Sessions
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_title text not null default 'Focus session',
  date date not null default current_date,
  minutes integer not null check (minutes > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes for optimal query performance
create index if not exists tasks_user_idx on public.tasks (user_id, status, deadline);
create index if not exists scheduled_tasks_user_date_idx on public.scheduled_tasks (user_id, scheduled_date, start_time);
create index if not exists commitments_user_idx on public.commitments (user_id);
create index if not exists reminders_user_idx on public.reminders (user_id, reminder_time);
create index if not exists focus_sessions_user_idx on public.focus_sessions (user_id, date desc);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.tasks enable row level security;
alter table public.scheduled_tasks enable row level security;
alter table public.commitments enable row level security;
alter table public.reminders enable row level security;
alter table public.focus_sessions enable row level security;

-- RLS Policies: Authenticated users can only read and write their own rows
drop policy if exists "profiles are private to their owner" on public.profiles;
create policy "profiles are private to their owner" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "routines are private to their owner" on public.routines;
create policy "routines are private to their owner" on public.routines
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks are private to their owner" on public.tasks;
create policy "tasks are private to their owner" on public.tasks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scheduled tasks are private to their owner" on public.scheduled_tasks;
create policy "scheduled tasks are private to their owner" on public.scheduled_tasks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "commitments are private to their owner" on public.commitments;
create policy "commitments are private to their owner" on public.commitments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders are private to their owner" on public.reminders;
create policy "reminders are private to their owner" on public.reminders
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "focus sessions are private to their owner" on public.focus_sessions;
create policy "focus sessions are private to their owner" on public.focus_sessions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
