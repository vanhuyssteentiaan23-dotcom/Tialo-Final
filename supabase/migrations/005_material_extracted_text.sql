-- TIALO STAGE 5: MATERIAL EXTRACTION
-- Stores normalized extracted text before chunking and AI indexing.

alter table public.materials
  add column if not exists extracted_text text,
  add column if not exists extracted_at timestamptz;
