-- Merge a duplicate tenant record into another: moves all tenancies (and so payments and agreements),
-- fills the kept record's empty details from the duplicate, then deletes the duplicate.
create or replace function public.merge_tenants(keep_id uuid, drop_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare d public.tenants;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if keep_id = drop_id then raise exception 'merge_error: cannot merge a tenant with itself.'; end if;
  if exists (select 1 from public.tenancies where tenant_id = keep_id and status = 'active')
     and exists (select 1 from public.tenancies where tenant_id = drop_id and status = 'active') then
    raise exception 'merge_error: both records are renting a room right now. Move one of them out first, or check the IC number is right.';
  end if;
  select * into d from public.tenants where id = drop_id;
  if not found then raise exception 'merge_error: tenant not found.'; end if;
  update public.tenancies set tenant_id = keep_id where tenant_id = drop_id;
  delete from public.tenants where id = drop_id;
  update public.tenants k set
    full_name = coalesce(nullif(k.full_name, ''), d.full_name),
    ic_no = coalesce(nullif(k.ic_no, ''), d.ic_no),
    phone = coalesce(nullif(k.phone, ''), d.phone),
    notes = nullif(concat_ws(E'\n', nullif(k.notes, ''), nullif(d.notes, ''),
      case when d.phone is not null and k.phone is not null and regexp_replace(d.phone, '\D', '', 'g') <> regexp_replace(k.phone, '\D', '', 'g') then 'Other phone: ' || d.phone end), '')
  where k.id = keep_id;
end $$;
revoke execute on function public.merge_tenants(uuid, uuid) from public, anon;
grant execute on function public.merge_tenants(uuid, uuid) to authenticated;
