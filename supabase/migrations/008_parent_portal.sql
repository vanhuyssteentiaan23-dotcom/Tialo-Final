-- TIALO PARENT PORTAL
-- Parent requests a link using the child's email. The child must accept before
-- the relationship becomes active. Parent reporting never exposes AI tutor chats.

create table if not exists public.parent_child (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','rejected')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(parent_id, child_id)
);

alter table public.parent_child add column if not exists status text not null default 'pending';
alter table public.parent_child add column if not exists accepted_at timestamptz;

create index if not exists parent_child_parent_idx on public.parent_child(parent_id, status);
create index if not exists parent_child_child_idx on public.parent_child(child_id, status);

alter table public.parent_child enable row level security;

drop policy if exists "Parents can view own child links" on public.parent_child;
drop policy if exists "Children can view incoming parent links" on public.parent_child;
drop policy if exists "Children can accept own parent links" on public.parent_child;
drop policy if exists "Children can reject own parent links" on public.parent_child;

create policy "Parents can view own child links" on public.parent_child
  for select using (auth.uid() = parent_id);
create policy "Children can view incoming parent links" on public.parent_child
  for select using (auth.uid() = child_id);

drop policy if exists "Parents can view linked child profiles" on public.profiles;
create policy "Parents can view linked child profiles" on public.profiles
  for select using (exists (select 1 from public.parent_child pc where pc.parent_id = auth.uid() and pc.child_id = profiles.id and pc.status = 'active'));

drop policy if exists "Children can view requesting parent profiles" on public.profiles;
create policy "Children can view requesting parent profiles" on public.profiles
  for select using (exists (select 1 from public.parent_child pc where pc.child_id = auth.uid() and pc.parent_id = profiles.id and pc.status = 'pending'));

drop policy if exists "Parents can view linked child subjects" on public.subjects;
create policy "Parents can view linked child subjects" on public.subjects
  for select using (exists (select 1 from public.parent_child pc where pc.parent_id = auth.uid() and pc.child_id = subjects.user_id and pc.status = 'active'));

drop policy if exists "Parents can view linked child daily tasks" on public.daily_study_tasks;
create policy "Parents can view linked child daily tasks" on public.daily_study_tasks
  for select using (exists (select 1 from public.parent_child pc where pc.parent_id = auth.uid() and pc.child_id = daily_study_tasks.user_id and pc.status = 'active'));

drop policy if exists "Parents can view linked child exams" on public.exam_attempts;
create policy "Parents can view linked child exams" on public.exam_attempts
  for select using (exists (select 1 from public.parent_child pc where pc.parent_id = auth.uid() and pc.child_id = exam_attempts.user_id and pc.status = 'active'));

create or replace function public.request_parent_link(child_email text)
returns json language plpgsql security definer set search_path = public as $$
declare parent_profile public.profiles%rowtype; child_profile public.profiles%rowtype; link_id uuid;
begin
  select * into parent_profile from public.profiles where id = auth.uid();
  if parent_profile.id is null or parent_profile.role <> 'parent' then raise exception 'Only parent accounts can request a child link.'; end if;
  select * into child_profile from public.profiles where lower(trim(email)) = lower(trim(child_email)) and role = 'student';
  if child_profile.id is null then raise exception 'No student account was found for that email address.'; end if;
  if child_profile.date_of_birth is null or date_part('year', age(current_date, child_profile.date_of_birth)) >= 16 then raise exception 'Parent linking is currently required only for students under 16.'; end if;
  if child_profile.id = auth.uid() then raise exception 'A parent account cannot be linked to itself.'; end if;
  insert into public.parent_child(parent_id, child_id, status) values (auth.uid(), child_profile.id, 'pending') on conflict (parent_id, child_id) do update set status = 'pending', accepted_at = null returning id into link_id;
  return json_build_object('id', link_id, 'status', 'pending');
end; $$;
grant execute on function public.request_parent_link(text) to authenticated;

create or replace function public.respond_parent_link(link_id uuid, accept_link boolean)
returns json language plpgsql security definer set search_path = public as $$
declare updated_id uuid; new_status text;
begin
  new_status := case when accept_link then 'active' else 'rejected' end;
  update public.parent_child set status = new_status, accepted_at = case when accept_link then now() else null end where id = link_id and child_id = auth.uid() and status = 'pending' returning id into updated_id;
  if updated_id is null then raise exception 'Parent link request not found or already handled.'; end if;
  return json_build_object('id', updated_id, 'status', new_status);
end; $$;
grant execute on function public.respond_parent_link(uuid, boolean) to authenticated;
