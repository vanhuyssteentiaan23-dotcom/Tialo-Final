-- TIALO Mock Exam 2.0 question types and graph data
alter table public.exam_questions
  add column if not exists question_type text not null default 'multiple_choice',
  add column if not exists model_answer text,
  add column if not exists grading_rubric text,
  add column if not exists chart_data jsonb not null default '{}'::jsonb;

alter table public.exam_questions
  drop constraint if exists exam_questions_question_type_check;

alter table public.exam_questions
  add constraint exam_questions_question_type_check
  check (question_type in ('multiple_choice','short_answer'));

create index if not exists exam_questions_type_idx
  on public.exam_questions(exam_id, question_type);
