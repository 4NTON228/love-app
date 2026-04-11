-- Таблица подписок
create table if not exists subscriptions (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  status        text not null default 'inactive', -- 'active' | 'cancelled' | 'past_due' | 'inactive'
  plan          text not null default 'premium',  -- 'premium' | 'premium_yearly'
  price_rub     integer not null default 299,      -- цена в рублях
  started_at    timestamptz,
  expires_at    timestamptz,
  cancelled_at  timestamptz,
  -- ЮKassa поля
  yk_payment_id         text,             -- ID платежа ЮKassa
  yk_payment_method_id  text,             -- ID сохранённого метода (для рекуррентных)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Уникальный индекс — у пользователя одна подписка
create unique index if not exists subscriptions_user_idx on subscriptions(user_id);

-- История платежей
create table if not exists payment_events (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete cascade,
  yk_payment_id text not null,
  event_type    text not null, -- 'payment.succeeded' | 'payment.canceled' | 'payment.waiting_for_capture'
  amount_rub    integer,
  raw           jsonb,
  created_at    timestamptz default now()
);

-- RLS
alter table subscriptions enable row level security;
alter table payment_events enable row level security;

-- Пользователь видит только свою подписку
create policy "own subscription" on subscriptions
  for all using (auth.uid() = user_id);

-- Пользователь видит только свои платежи
create policy "own payments" on payment_events
  for all using (auth.uid() = user_id);

-- Service role может всё (для Edge Functions)
create policy "service full access subs" on subscriptions
  for all using (auth.role() = 'service_role');

create policy "service full access payments" on payment_events
  for all using (auth.role() = 'service_role');
