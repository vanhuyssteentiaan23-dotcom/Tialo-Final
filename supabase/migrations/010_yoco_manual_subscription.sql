-- TIALO manual monthly billing through Yoco.
-- Payment expiry NEVER deletes student data.

alter table public.subscriptions
  add column if not exists status text not null default 'inactive',
  add column if not exists current_period_start timestamptz,
  add column if not exists yoco_checkout_id text,
  add column if not exists yoco_payment_id text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists access_until timestamptz;

create unique index if not exists subscriptions_user_id_unique_idx
  on public.subscriptions (user_id);

create unique index if not exists subscriptions_yoco_checkout_unique_idx
  on public.subscriptions (yoco_checkout_id)
  where yoco_checkout_id is not null;

create index if not exists subscriptions_access_until_idx
  on public.subscriptions (access_until);

create index if not exists subscriptions_yoco_payment_idx
  on public.subscriptions (yoco_payment_id);

-- Never remove student data when access expires. Subscription status is only an entitlement flag.
comment on column public.subscriptions.access_until is
  'Paid access expiry only. Expiry must never delete or modify student academic data.';

comment on column public.subscriptions.status is
  'Billing entitlement state: active, inactive, expired, pending, failed.';
