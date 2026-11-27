-- Shared rooms: a room can have several beds, each with its own tenant, rent and payments.
alter table public.rooms add column beds int not null default 1 check (beds between 1 and 6);
drop index if exists public.one_active_tenancy_per_room;

create or replace function public.check_room_capacity() returns trigger
language plpgsql set search_path = public as $$
declare cap int; used int;
begin
  if new.status <> 'active' then return new; end if;
  select beds into cap from public.rooms where id = new.room_id for update;
  select count(*) into used from public.tenancies where room_id = new.room_id and status = 'active' and id <> new.id;
  if used >= cap then
    raise exception 'room_full: this room has % bed(s) and all are taken. Move a tenant out first, or add a bed in Rooms.', cap;
  end if;
  return new;
end $$;
create trigger tenancies_room_capacity before insert or update of room_id, status on public.tenancies
  for each row execute function public.check_room_capacity();

create or replace function public.check_room_beds() returns trigger
language plpgsql set search_path = public as $$
declare used int;
begin
  select count(*) into used from public.tenancies where room_id = new.id and status = 'active';
  if new.beds < used then
    raise exception 'room_full: % tenants live in this room now, so it needs at least % beds.', used, used;
  end if;
  return new;
end $$;
create trigger rooms_beds_check before update of beds on public.rooms
  for each row execute function public.check_room_beds();
