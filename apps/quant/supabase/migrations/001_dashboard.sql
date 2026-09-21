create table if not exists public.paper_snapshots (
  episode_id text not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  as_of timestamptz not null,
  payload jsonb not null,
  primary key (episode_id, month)
);

create table if not exists public.live_snapshots (
  episode_id text not null,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  as_of timestamptz not null,
  payload jsonb not null,
  owner_id uuid not null,
  primary key (episode_id, month)
);

alter table public.paper_snapshots enable row level security;
alter table public.paper_snapshots force row level security;
alter table public.live_snapshots enable row level security;
alter table public.live_snapshots force row level security;

revoke all on table public.paper_snapshots from anon, authenticated;
revoke all on table public.live_snapshots from anon, authenticated;
grant select on table public.paper_snapshots to anon, authenticated;
grant select on table public.live_snapshots to authenticated;

drop policy if exists "paper snapshots are public read only" on public.paper_snapshots;
create policy "paper snapshots are public read only"
  on public.paper_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "owners read their live snapshots" on public.live_snapshots;
create policy "owners read their live snapshots"
  on public.live_snapshots
  for select
  to authenticated
  using (owner_id = (select auth.uid()));
