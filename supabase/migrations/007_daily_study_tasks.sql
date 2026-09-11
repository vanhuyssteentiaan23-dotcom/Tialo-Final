create table if not exists public.daily_study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  description text,
  task_date date not null default current_date,
  estimated_minutes integer not null default 30 check (estimated_minutes > 0 and estimated_minutes <= 240),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists daily_study_tasks_user_date_idx on public.daily_study_tasks(user_id, task_date, created_at);
create index if not exists daily_study_tasks_subject_idx on public.daily_study_tasks(subject_id, task_date);

alter table public.daily_study_tasks enable row level security;

drop policy if exists "Users can view own daily tasks" on public.daily_study_tasks;
drop policy if exists "Users can insert own daily tasks" on public.daily_study_tasks;
drop policy if exists "Users can update own daily tasks" on public.daily_study_tasks;
drop policy if exists "Users can delete own daily tasks" on public.daily_study_tasks;

create policy "Users can view own daily tasks" on public.daily_study_tasks
  for select using (auth.uid() = user_id);
create policy "Users can insert own daily tasks" on public.daily_study_tasks
  for insert with check (auth.uid() = user_id);
create policy "Users can update own daily tasks" on public.daily_study_tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own daily tasks" on public.daily_study_tasks
  for delete using (auth.uid() = user_id);
