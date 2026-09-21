-- TIALO SUMMARIES
-- Stores page-aware PDF text and student-generated summaries.

alter table public.materials
  add column if not exists page_text jsonb default '[]'::jsonb;

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  material_ids uuid[] not null default '{}',
  chapter_request text,
  summary_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists summaries_user_created_idx
  on public.summaries (user_id, created_at desc);

alter table public.summaries enable row level security;

drop policy if exists summaries_select_own on public.summaries;
create policy summaries_select_own on public.summaries
  for select using (auth.uid() = user_id);

drop policy if exists summaries_insert_own on public.summaries;
create policy summaries_insert_own on public.summaries
  for insert with check (auth.uid() = user_id);

drop policy if exists summaries_update_own on public.summaries;
create policy summaries_update_own on public.summaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists summaries_delete_own on public.summaries;
create policy summaries_delete_own on public.summaries
  for delete using (auth.uid() = user_id);
