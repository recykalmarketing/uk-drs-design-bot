create table if not exists public.retearn_creative_workflows (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.retearn_creative_workflows enable row level security;

-- The bot uses the Supabase service-role key only on the server.
-- Do not expose that key in the browser.
