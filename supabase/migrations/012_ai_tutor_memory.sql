create table if not exists public.ai_tutor_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_tutor_chats_user_subject_updated_idx on public.ai_tutor_chats (user_id, subject_id, updated_at desc);
create table if not exists public.ai_tutor_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.ai_tutor_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  source_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_tutor_messages_chat_created_idx on public.ai_tutor_messages (chat_id, created_at asc);
alter table public.ai_tutor_chats enable row level security;
alter table public.ai_tutor_messages enable row level security;
drop policy if exists ai_tutor_chats_select_own on public.ai_tutor_chats;
create policy ai_tutor_chats_select_own on public.ai_tutor_chats for select using (auth.uid() = user_id);
drop policy if exists ai_tutor_chats_insert_own on public.ai_tutor_chats;
create policy ai_tutor_chats_insert_own on public.ai_tutor_chats for insert with check (auth.uid() = user_id);
drop policy if exists ai_tutor_chats_update_own on public.ai_tutor_chats;
create policy ai_tutor_chats_update_own on public.ai_tutor_chats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists ai_tutor_chats_delete_own on public.ai_tutor_chats;
create policy ai_tutor_chats_delete_own on public.ai_tutor_chats for delete using (auth.uid() = user_id);
drop policy if exists ai_tutor_messages_select_own on public.ai_tutor_messages;
create policy ai_tutor_messages_select_own on public.ai_tutor_messages for select using (auth.uid() = user_id);
drop policy if exists ai_tutor_messages_insert_own on public.ai_tutor_messages;
create policy ai_tutor_messages_insert_own on public.ai_tutor_messages for insert with check (auth.uid() = user_id);
drop policy if exists ai_tutor_messages_delete_own on public.ai_tutor_messages;
create policy ai_tutor_messages_delete_own on public.ai_tutor_messages for delete using (auth.uid() = user_id);
create or replace function public.ai_tutor_touch_chat()
returns trigger language plpgsql as $$
begin update public.ai_tutor_chats set updated_at = now() where id = new.chat_id; return new; end;
$$;
drop trigger if exists ai_tutor_touch_chat_trigger on public.ai_tutor_messages;
create trigger ai_tutor_touch_chat_trigger after insert on public.ai_tutor_messages for each row execute function public.ai_tutor_touch_chat();
