create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  question_count integer not null default 10,
  score integer,
  total_marks integer not null default 10,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exam_attempts(id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  student_answer text,
  marks integer not null default 1,
  explanation text,
  created_at timestamptz not null default now(),
  unique (exam_id, position)
);

create index if not exists exam_attempts_user_created_idx on public.exam_attempts(user_id, created_at desc);
create index if not exists exam_attempts_subject_idx on public.exam_attempts(subject_id, created_at desc);
create index if not exists exam_questions_exam_idx on public.exam_questions(exam_id, position);

alter table public.exam_attempts enable row level security;
alter table public.exam_questions enable row level security;

drop policy if exists "Users can view own exam attempts" on public.exam_attempts;
drop policy if exists "Users can insert own exam attempts" on public.exam_attempts;
drop policy if exists "Users can update own exam attempts" on public.exam_attempts;
drop policy if exists "Users can delete own exam attempts" on public.exam_attempts;

create policy "Users can view own exam attempts" on public.exam_attempts
  for select using (auth.uid() = user_id);
create policy "Users can insert own exam attempts" on public.exam_attempts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own exam attempts" on public.exam_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own exam attempts" on public.exam_attempts
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own exam questions" on public.exam_questions;
drop policy if exists "Users can insert own exam questions" on public.exam_questions;
drop policy if exists "Users can update own exam questions" on public.exam_questions;
drop policy if exists "Users can delete own exam questions" on public.exam_questions;

create policy "Users can view own exam questions" on public.exam_questions
  for select using (exists (select 1 from public.exam_attempts e where e.id = exam_questions.exam_id and e.user_id = auth.uid()));
create policy "Users can insert own exam questions" on public.exam_questions
  for insert with check (exists (select 1 from public.exam_attempts e where e.id = exam_questions.exam_id and e.user_id = auth.uid()));
create policy "Users can update own exam questions" on public.exam_questions
  for update using (exists (select 1 from public.exam_attempts e where e.id = exam_questions.exam_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.exam_attempts e where e.id = exam_questions.exam_id and e.user_id = auth.uid()));
create policy "Users can delete own exam questions" on public.exam_questions
  for delete using (exists (select 1 from public.exam_attempts e where e.id = exam_questions.exam_id and e.user_id = auth.uid()));
