-- =====================================================================
-- Mise à jour 4 : documents du dentiste (scans).
--   - carte professionnelle (justificatif d'inscription à l'Ordre)
--   - patente
-- Fichiers stockés dans un bucket PRIVÉ « dentist-docs » (Supabase Storage) :
-- un dentiste ne voit que ses fichiers, l'administration voit tout.
-- À exécuter une fois dans le SQL Editor de Supabase.
-- =====================================================================
alter table public.dentists
  add column if not exists card_path text,
  add column if not exists patente_path text;

-- ---------- Stockage privé ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dentist-docs', 'dentist-docs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists dentist_docs_insert on storage.objects;
create policy dentist_docs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dentist-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.auth_role() = 'dentist'
  );

drop policy if exists dentist_docs_update on storage.objects;
create policy dentist_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'dentist-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dentist-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists dentist_docs_select on storage.objects;
create policy dentist_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'dentist-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.auth_role() = 'admin')
  );

-- ---------- Enregistrement des chemins ----------
create or replace function public.save_dentist_documents(p_card text, p_patente text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d public.dentists;
  v_changed boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'dentist' then raise exception 'not_a_dentist'; end if;
  if p_card is null or p_patente is null
     or p_card not like v_uid::text || '/%' or p_patente not like v_uid::text || '/%'
     or length(p_card) > 300 or length(p_patente) > 300 then
    raise exception 'invalid_input';
  end if;
  select * into d from public.dentists where id = v_uid for update;
  if not found then raise exception 'dentist_not_found'; end if;
  if public._has_active_request(v_uid) then raise exception 'busy'; end if;

  v_changed := d.card_path is distinct from p_card or d.patente_path is distinct from p_patente;
  if not v_changed then return d.status::text; end if;

  update public.dentists
     set card_path = p_card, patente_path = p_patente,
         status = case when d.status = 'suspended' then 'suspended'::public.dentist_status
                       else 'pending'::public.dentist_status end,
         available_until = null, updated_at = now()
   where id = v_uid
  returning * into d;
  perform public._audit('documents_updated', v_uid, v_uid);
  return d.status::text;
end;
$$;

-- ---------- Admin : liste avec les chemins des documents ----------
drop function if exists public.admin_list_dentists(public.dentist_status);
create function public.admin_list_dentists(p_status public.dentist_status default null)
returns table (
  id uuid, email text, full_name text, clinic_name text, address text, zone_id text,
  phone text, order_number text, status public.dentist_status, status_note text,
  available_until timestamptz, created_at timestamptz, card_path text, patente_path text
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
    select d.id, u.email::text, d.full_name, d.clinic_name, d.address, d.zone_id,
           d.phone, d.order_number, d.status, d.status_note, d.available_until, d.created_at,
           d.card_path, d.patente_path
      from public.dentists d
      join auth.users u on u.id = d.id
     where p_status is null or d.status = p_status
     order by (d.status = 'pending') desc, d.created_at desc;
end;
$$;

-- ---------- Admin : pas de validation sans les deux documents ----------
create or replace function public.admin_set_dentist_status(
  p_dentist uuid, p_status public.dentist_status, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare d public.dentists;
begin
  perform public._require_admin();
  perform public.expire_stale_requests();
  if p_status = 'pending' then raise exception 'invalid_input'; end if;
  select * into d from public.dentists where id = p_dentist;
  if not found then raise exception 'dentist_not_found'; end if;
  if public._has_active_request(p_dentist) then raise exception 'busy'; end if;
  if p_status = 'approved' and d.status <> 'approved'
     and (d.card_path is null or d.patente_path is null) then
    raise exception 'documents_missing';
  end if;

  update public.dentists
     set status = p_status,
         status_note = nullif(btrim(coalesce(p_note, '')), ''),
         available_until = null,
         updated_at = now()
   where id = p_dentist;
  insert into public.admin_actions (admin_id, dentist_id, action, note)
  values (auth.uid(), p_dentist, p_status::text, nullif(btrim(coalesce(p_note, '')), ''));
  perform public._audit(p_status::text, auth.uid(), p_dentist);
end;
$$;

revoke all on function public.save_dentist_documents(text, text) from public, anon, authenticated;
revoke all on function public.admin_list_dentists(public.dentist_status) from public, anon, authenticated;
revoke all on function public.admin_set_dentist_status(uuid, public.dentist_status, text) from public, anon, authenticated;
grant execute on function public.save_dentist_documents(text, text) to authenticated;
grant execute on function public.admin_list_dentists(public.dentist_status) to authenticated;
grant execute on function public.admin_set_dentist_status(uuid, public.dentist_status, text) to authenticated;
