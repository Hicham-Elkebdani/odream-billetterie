-- Run once in Supabase SQL Editor for a new, empty project.
-- Ticket data is accessed only by the authenticated Next.js server through DATABASE_URL.
create table if not exists public.event_settings (
  id text primary key,
  name text not null,
  date text not null,
  time text not null,
  departure text not null,
  destination text not null,
  price_cents integer,
  capacity integer,
  program text not null,
  checkpoints text not null
);

create table if not exists public.tickets (
  id uuid primary key,
  reference text not null unique,
  token text not null unique,
  name text not null,
  email text not null,
  phone text not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  amount_cents integer,
  created_at text not null,
  paid_at text,
  paid_by text,
  cancelled_at text,
  refunded_at text,
  sent_at text,
  email_id text,
  email_attempt text,
  email_error text,
  email_payload text,
  email_attempt_at text
);

create table if not exists public.checkins (
  id uuid primary key,
  ticket_id uuid not null references public.tickets(id),
  checkpoint text not null,
  scanned_at text not null,
  scanned_by text not null,
  constraint one_checkin_per_checkpoint unique (ticket_id, checkpoint)
);

create index if not exists tickets_created_at_idx on public.tickets(created_at desc);
create index if not exists checkins_scanned_at_idx on public.checkins(scanned_at desc);

alter table public.event_settings enable row level security;
alter table public.tickets enable row level security;
alter table public.checkins enable row level security;
revoke all on public.event_settings, public.tickets, public.checkins from anon, authenticated;

-- Lock the event row while checking capacity, so simultaneous registrations cannot oversell.
create or replace function public.create_ticket(
  p_id uuid, p_reference text, p_token text, p_name text, p_email text,
  p_phone text, p_status text, p_amount_cents integer, p_created_at text,
  p_paid_at text, p_paid_by text
) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_capacity integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('odream-event-main'));
  if exists (select 1 from public.tickets where id = p_id) then
    return 'existing';
  end if;

  select capacity into v_capacity from public.event_settings where id = 'main' for update;
  if v_capacity is not null and
     (select count(*) from public.tickets where status <> 'cancelled') >= v_capacity then
    return 'full';
  end if;

  insert into public.tickets
    (id, reference, token, name, email, phone, status, amount_cents, created_at, paid_at, paid_by)
  values
    (p_id, p_reference, p_token, p_name, p_email, p_phone, p_status, p_amount_cents, p_created_at, p_paid_at, p_paid_by)
  on conflict (id) do nothing;

  if found then return 'created'; end if;
  return 'existing';
end;
$$;

revoke all on function public.create_ticket(uuid,text,text,text,text,text,text,integer,text,text,text) from public, anon, authenticated;

create or replace function public.update_event_settings(
  p_name text, p_date text, p_time text, p_departure text, p_destination text,
  p_price_cents integer, p_capacity integer, p_program text, p_checkpoints text
) returns text
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('odream-event-main'));
  if p_capacity is not null and
     (select count(*) from public.tickets where status <> 'cancelled') > p_capacity then
    return 'too_small';
  end if;

  insert into public.event_settings
    (id, name, date, time, departure, destination, price_cents, capacity, program, checkpoints)
  values
    ('main', p_name, p_date, p_time, p_departure, p_destination,
     p_price_cents, p_capacity, p_program, p_checkpoints)
  on conflict (id) do update set
    name=excluded.name, date=excluded.date, time=excluded.time,
    departure=excluded.departure, destination=excluded.destination,
    price_cents=excluded.price_cents, capacity=excluded.capacity,
    program=excluded.program, checkpoints=excluded.checkpoints;
  return 'saved';
end;
$$;

revoke all on function public.update_event_settings(text,text,text,text,text,integer,integer,text,text) from public, anon, authenticated;
