-- TIALO STAGE 5: MATERIAL METADATA
-- Adds the metadata needed to connect private Storage files to the materials table.
-- Safe to run even if some columns already exist.

alter table public.materials
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists processing_status text default 'uploaded',
  add column if not exists processing_error text,
  add column if not exists uploaded_at timestamptz default now();

create index if not exists materials_user_subject_idx
  on public.materials (user_id, subject_id);

create index if not exists materials_processing_status_idx
  on public.materials (processing_status);

-- Keep the status controlled to the states used by the application.
alter table public.materials
  drop constraint if exists materials_processing_status_check;

alter table public.materials
  add constraint materials_processing_status_check
  check (processing_status in ('uploaded', 'processing', 'ready', 'failed'));
