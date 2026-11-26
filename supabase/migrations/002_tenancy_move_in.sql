-- Payments must belong to a tenancy that covers that month; amounts that differ from rent need a note.
alter table public.tenancies add column moved_in_on date;
create or replace function public.check_payment() returns trigger
language plpgsql set search_path = public as $$
declare t public.tenancies; paid numeric;
begin
  select * into t from public.tenancies where id = new.tenancy_id;
  if coalesce(t.moved_in_on, t.start_date) is not null and new.period < date_trunc('month', coalesce(t.moved_in_on, t.start_date))::date then
    raise exception 'Payment month is before this tenant moved in (%).', coalesce(t.moved_in_on, t.start_date);
  end if;
  if t.status = 'ended' and t.moved_out_on is not null and new.period > date_trunc('month', t.moved_out_on)::date then
    raise exception 'Tenant moved out on %; cannot record a later month.', t.moved_out_on;
  end if;
  select coalesce(sum(amount),0) into paid from public.payments
    where tenancy_id = new.tenancy_id and period = new.period and id <> new.id;
  if paid + new.amount <> t.monthly_rent and coalesce(trim(new.note),'') = '' then
    raise exception 'Amount for this month (RM%) does not match rent (RM%). Add a note explaining why.', paid + new.amount, t.monthly_rent;
  end if;
  return new;
end $$;
create trigger payments_check before insert or update on public.payments
  for each row execute function public.check_payment();
