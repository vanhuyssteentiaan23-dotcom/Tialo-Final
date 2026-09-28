-- TIALO Mock Exam 2.1 source sketch / diagram references
alter table public.exam_questions
  add column if not exists visual_data jsonb not null default '{}'::jsonb;

create index if not exists exam_questions_visual_idx
  on public.exam_questions(exam_id);
