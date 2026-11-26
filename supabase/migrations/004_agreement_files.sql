-- Agreement documents: premises address override, IC photos, signed copy, extra template fields.
alter table public.tenancies
  add column premises_address text,
  add column ic_front_path text,
  add column ic_back_path text,
  add column signed_file_path text,
  add column signed_uploaded_at timestamptz,
  add column extra_fields jsonb not null default '{}'::jsonb;

-- Private bucket: template/agreement.docx, ic/<tenancy>-front|back.*, signed/<tenancy>-<time>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agreements', 'agreements', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "admins read agreement files" on storage.objects for select to authenticated using (bucket_id = 'agreements' and public.is_admin());
create policy "admins add agreement files" on storage.objects for insert to authenticated with check (bucket_id = 'agreements' and public.is_admin());
create policy "admins change agreement files" on storage.objects for update to authenticated using (bucket_id = 'agreements' and public.is_admin());
create policy "admins delete agreement files" on storage.objects for delete to authenticated using (bucket_id = 'agreements' and public.is_admin());
