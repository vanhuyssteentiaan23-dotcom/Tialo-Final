-- TIALO STAGE 5: PRIVATE MATERIAL STORAGE
-- Creates a private bucket for each user's study materials.

insert into storage.buckets (id, name, public)
values ('study-materials', 'study-materials', false)
on conflict (id) do update set public = false;

-- Files are stored under: {user_id}/{subject_id}/{filename}
-- A user may manage only files inside their own top-level user_id folder.

drop policy if exists "Users can view own study materials" on storage.objects;
drop policy if exists "Users can upload own study materials" on storage.objects;
drop policy if exists "Users can update own study materials" on storage.objects;
drop policy if exists "Users can delete own study materials" on storage.objects;

create policy "Users can view own study materials"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own study materials"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own study materials"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own study materials"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);
