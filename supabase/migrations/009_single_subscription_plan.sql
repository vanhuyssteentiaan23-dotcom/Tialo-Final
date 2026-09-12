-- TIALO has one paid plan only: R250/month.
-- This migration is additive and safe to run against the existing schema.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_zar integer not null check (price_zar > 0),
  interval text not null default 'month' check (interval = 'month'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, price_zar, interval, active)
values ('tialo_full', 'TIALO Full', 250, 'month', true)
on conflict (code) do update set
  name = excluded.name,
  price_zar = excluded.price_zar,
  interval = excluded.interval,
  active = excluded.active;

-- Remove any obsolete Basic-plan rows if the table was used by an earlier build.
delete from public.subscription_plans where code = 'basic';

alter table public.subscriptions
  add column if not exists plan_code text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

update public.subscriptions
set plan_code = 'tialo_full'
where plan_code is null;

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id);

alter table public.subscription_plans enable row level security;

drop policy if exists "Anyone can read active subscription plans" on public.subscription_plans;
create policy "Anyone can read active subscription plans"
on public.subscription_plans
for select
to authenticated
using (active = true);

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid());
