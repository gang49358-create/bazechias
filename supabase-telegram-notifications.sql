-- Run once in Supabase SQL Editor.
-- Stores only order IDs already notified; no customer data is copied here.
create table if not exists public.telegram_order_notifications (
  order_id text primary key,
  sent_at timestamptz not null default now()
);

alter table public.telegram_order_notifications enable row level security;

revoke all on public.telegram_order_notifications from anon, authenticated;
grant all on public.telegram_order_notifications to service_role;
