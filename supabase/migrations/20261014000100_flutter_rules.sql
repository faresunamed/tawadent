-- =====================================================================
-- Mise à jour 2, SCRIPT 2 sur 2 : règles métier reprises du projet Flutter
-- (à exécuter APRÈS 20261014000000_request_status_values.sql)
--
--  * Parcours complet : confirmé -> patient arrivé -> consultation terminée
--  * Le cabinet reste réservé pendant le trajet et la consultation
--  * Une demande expirée (60 s) libère la place SANS couper la disponibilité
--  * L'admin ne peut pas modifier un cabinet qui a une demande active
--  * Le dentiste ne peut pas modifier son profil / sa disponibilité en cours de demande
--  * Toute modification du profil remet en validation et rend indisponible
--  * Numéro d'Ordre unique ; téléphone tunisien +216 + 8 chiffres
--  * Journal d'activité (sans aucune donnée médicale)
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'request_status' and e.enumlabel = 'arrived'
  ) then
    raise exception 'Exécutez d''abord le script 20261014000000_request_status_values.sql';
  end if;
end $$;

-- ---------- Téléphone tunisien et numéro d'Ordre unique ----------
update public.dentists set phone = regexp_replace(phone, '[ ()-]', '', 'g');
update public.dentists set phone = '+216' || phone where phone ~ '^[0-9]{8}$';

alter table public.dentists drop constraint if exists dentists_phone_check;
alter table public.dentists drop constraint if exists dentists_phone_tn;
alter table public.dentists
  add constraint dentists_phone_tn check (phone ~ '^\+216[0-9]{8}$') not valid;

create unique index if not exists dentists_registration_unique
  on public.dentists (lower(btrim(order_number)));

-- ---------- Demandes : une seule demande ACTIVE par cabinet et par patient ----------
alter table public.requests
  add column if not exists arrived_at timestamptz,
  add column if not exists completed_at timestamptz;

drop index if exists public.requests_one_pending_per_dentist;
drop index if exists public.requests_one_pending_per_patient;
create unique index if not exists requests_one_active_per_dentist
  on public.requests (dentist_id) where status in ('pending', 'accepted', 'arrived');
create unique index if not exists requests_one_active_per_patient
  on public.requests (patient_id) where status in ('pending', 'accepted', 'arrived');

-- ---------- Journal d'activité ----------
create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  actor_id uuid,            -- null = système
  dentist_id uuid references public.dentists (id) on delete cascade,
  request_id uuid references public.requests (id) on delete cascade
);
create index if not exists audit_events_at_idx on public.audit_events (id desc);

alter table public.audit_events enable row level security;
drop policy if exists audit_events_read on public.audit_events;
create policy audit_events_read on public.audit_events for select to authenticated
  using (public.auth_role() = 'admin');
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

create or replace function public._audit(
  p_action text, p_actor uuid, p_dentist uuid default null, p_request uuid default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_events (action, actor_id, dentist_id, request_id)
  values (p_action, p_actor, p_dentist, p_request)
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'dentist'
         then 'dentist'::public.app_role
         else 'patient'::public.app_role end
  );
  perform public._audit('registered', new.id);
  return new;
end;
$$;

-- ---------- Fonctions internes ----------
create or replace function public._has_active_request(p_dentist uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.requests
     where dentist_id = p_dentist and status in ('pending', 'accepted', 'arrived')
  )
$$;

-- Après 60 s sans confirmation la demande expire et la place est libérée.
-- La disponibilité du cabinet reste valable jusqu'à son échéance (60 min).
create or replace function public.expire_stale_requests()
returns void
language sql security definer set search_path = public as $$
  with exp as (
    update public.requests
       set status = 'expired'
     where status = 'pending' and expires_at <= now()
    returning id, dentist_id
  )
  insert into public.audit_events (action, actor_id, dentist_id, request_id)
  select 'timed_out', null, dentist_id, id from exp;
$$;

create or replace function public._request_json(r public.requests)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  res jsonb;
  c record;
begin
  select d.clinic_name, d.full_name, d.address, d.phone, d.latitude, d.longitude
    into c
    from public.dentists d
   where d.id = r.dentist_id;

  res := jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'zone_id', r.zone_id,
    'clinic_name', c.clinic_name,
    'created_at', r.created_at,
    'expires_at', r.expires_at,
    'arrived_at', r.arrived_at,
    'seconds_left',
      case when r.status = 'pending'
           then greatest(0, ceil(extract(epoch from (r.expires_at - now()))))::int
           else 0 end
  );

  -- Les coordonnées ne sont révélées qu'après confirmation du cabinet.
  if r.status in ('accepted', 'arrived', 'completed') then
    res := res || jsonb_build_object('clinic', jsonb_build_object(
      'clinic_name', c.clinic_name,
      'dentist_name', c.full_name,
      'address', c.address,
      'phone', c.phone,
      'latitude', c.latitude,
      'longitude', c.longitude
    ));
  end if;
  return res;
end;
$$;

-- ---------- Patient ----------
create or replace function public.list_available_clinics(p_zone text)
returns table (id uuid, clinic_name text, dentist_name text, zone_id text, available_until timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.clinic_name, d.full_name, d.zone_id, d.available_until
    from public.dentists d
   where d.status = 'approved'
     and d.zone_id = p_zone
     and d.available_until > now()
     and not exists (
       select 1 from public.requests r
        where r.dentist_id = d.id
          and ( (r.status = 'pending' and r.expires_at > now())
                or r.status in ('accepted', 'arrived') )
     )
   order by d.clinic_name
$$;

create or replace function public.create_request(p_dentist uuid, p_first_name text, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_zone text;
  v_name text := btrim(coalesce(p_first_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_recent int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'patient' then raise exception 'not_a_patient'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'invalid_input'; end if;
  if v_phone is not null and v_phone !~ '^[0-9+ ()-]{6,30}$' then raise exception 'invalid_input'; end if;

  perform public.expire_stale_requests();

  select count(*) into v_recent
    from public.requests
   where patient_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'rate_limited'; end if;

  if exists (select 1 from public.requests
              where patient_id = v_uid and status in ('pending', 'accepted', 'arrived')) then
    raise exception 'patient_has_active_request';
  end if;

  select d.zone_id into v_zone
    from public.dentists d
   where d.id = p_dentist and d.status = 'approved' and d.available_until > now()
   for update;
  if not found then raise exception 'clinic_unavailable'; end if;

  if public._has_active_request(p_dentist) then raise exception 'clinic_busy'; end if;

  begin
    insert into public.requests (patient_id, dentist_id, zone_id, patient_first_name, patient_phone, expires_at)
    values (v_uid, p_dentist, v_zone, v_name, v_phone, now() + interval '60 seconds')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'clinic_busy';
  end;

  perform public._audit('requested', v_uid, p_dentist, v_id);
  return v_id;
end;
$$;

create or replace function public.get_my_latest_request()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();
  select * into r
    from public.requests
   where patient_id = auth.uid()
     and status in ('pending', 'accepted', 'arrived')
     and created_at > now() - interval '12 hours'
   order by created_at desc
   limit 1;
  if not found then return null; end if;
  return public._request_json(r);
end;
$$;

create or replace function public.list_my_requests()
returns table (id uuid, status public.request_status, clinic_name text, zone_id text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();
  return query
    select r.id, r.status, d.clinic_name, r.zone_id, r.created_at
      from public.requests r
      join public.dentists d on d.id = r.dentist_id
     where r.patient_id = auth.uid()
     order by r.created_at desc
     limit 10;
end;
$$;

-- Annulation possible tant que la demande est en attente ou confirmée (pas après l'arrivée).
create or replace function public.cancel_request(p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();
  select * into r from public.requests where id = p_request and patient_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status not in ('pending', 'accepted') then return r.status::text; end if;
  update public.requests
     set status = 'cancelled', responded_at = coalesce(responded_at, now())
   where id = r.id;
  perform public._audit('cancelled', auth.uid(), r.dentist_id, r.id);
  return 'cancelled';
end;
$$;

create or replace function public.mark_arrived(p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from public.requests where id = p_request and patient_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status = 'arrived' then return 'arrived'; end if;
  if r.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  update public.requests set status = 'arrived', arrived_at = now() where id = r.id;
  perform public._audit('arrived', auth.uid(), r.dentist_id, r.id);
  return 'arrived';
end;
$$;

-- ---------- Dentiste ----------
create or replace function public.respond_request(p_request uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();

  select * into r from public.requests where id = p_request and dentist_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status <> 'pending' then return r.status::text; end if;

  if p_accept then
    if not exists (select 1 from public.dentists where id = auth.uid() and status = 'approved') then
      raise exception 'dentist_not_approved';
    end if;
    update public.requests set status = 'accepted', responded_at = now() where id = r.id;
    -- Une consultation confirmée consomme la disponibilité.
    update public.dentists set available_until = null, updated_at = now() where id = auth.uid();
    perform public._audit('confirmed', auth.uid(), auth.uid(), r.id);
    return 'accepted';
  else
    update public.requests set status = 'declined', responded_at = now() where id = r.id;
    perform public._audit('declined', auth.uid(), auth.uid(), r.id);
    return 'declined';
  end if;
end;
$$;

create or replace function public.complete_request(p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from public.requests where id = p_request and dentist_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status = 'completed' then return 'completed'; end if;
  if r.status <> 'arrived' then raise exception 'invalid_transition'; end if;
  update public.requests set status = 'completed', completed_at = now() where id = r.id;
  perform public._audit('completed', auth.uid(), auth.uid(), r.id);
  return 'completed';
end;
$$;

-- Le patient confirmé ne s'est jamais présenté : le dentiste libère son cabinet.
create or replace function public.release_request(p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from public.requests where id = p_request and dentist_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status = 'cancelled' then return 'cancelled'; end if;
  if r.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  update public.requests set status = 'cancelled' where id = r.id;
  perform public._audit('released', auth.uid(), auth.uid(), r.id);
  return 'cancelled';
end;
$$;

create or replace function public.set_availability(p_active boolean)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'dentist' then raise exception 'not_a_dentist'; end if;
  perform public.expire_stale_requests();
  if public._has_active_request(auth.uid()) then raise exception 'busy'; end if;
  if not exists (select 1 from public.dentists where id = auth.uid() and status = 'approved') then
    raise exception 'dentist_not_approved';
  end if;
  v_until := case when p_active then now() + interval '60 minutes' else null end;
  update public.dentists set available_until = v_until, updated_at = now() where id = auth.uid();
  perform public._audit(case when p_active then 'available' else 'unavailable' end,
                        auth.uid(), auth.uid());
  return v_until;
end;
$$;

create or replace function public.save_dentist_profile(
  p_full_name text, p_clinic_name text, p_address text, p_zone_id text,
  p_phone text, p_latitude double precision, p_longitude double precision, p_order_number text
) returns public.dentist_status
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  cur public.dentists;
  v_full text := btrim(coalesce(p_full_name, ''));
  v_clinic text := btrim(coalesce(p_clinic_name, ''));
  v_addr text := btrim(coalesce(p_address, ''));
  v_order text := btrim(coalesce(p_order_number, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[ ()-]', '', 'g');
  v_status public.dentist_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'dentist' then raise exception 'not_a_dentist'; end if;

  if v_phone ~ '^[0-9]{8}$' then v_phone := '+216' || v_phone; end if;
  if v_phone !~ '^\+216[0-9]{8}$'
     or char_length(v_full) not between 2 and 120
     or char_length(v_clinic) not between 2 and 120
     or char_length(v_addr) not between 5 and 250
     or char_length(v_order) not between 2 and 60
     or not exists (select 1 from public.zones where id = p_zone_id)
     or (p_latitude is not null and p_latitude not between -90 and 90)
     or (p_longitude is not null and p_longitude not between -180 and 180) then
    raise exception 'invalid_input';
  end if;

  if exists (select 1 from public.dentists
              where lower(btrim(order_number)) = lower(v_order) and id <> v_uid) then
    raise exception 'registration_used';
  end if;

  perform public.expire_stale_requests();
  select * into cur from public.dentists where id = v_uid for update;

  if not found then
    begin
      insert into public.dentists (id, full_name, clinic_name, address, zone_id, phone, latitude, longitude, order_number)
      values (v_uid, v_full, v_clinic, v_addr, p_zone_id, v_phone, p_latitude, p_longitude, v_order);
    exception when unique_violation then
      raise exception 'registration_used';
    end;
    perform public._audit('profile_created', v_uid, v_uid);
    return 'pending';
  end if;

  if public._has_active_request(v_uid) then raise exception 'busy'; end if;

  -- Aucun changement : rien à revalider.
  if cur.full_name = v_full and cur.clinic_name = v_clinic and cur.address = v_addr
     and cur.zone_id = p_zone_id and cur.phone = v_phone
     and cur.latitude is not distinct from p_latitude
     and cur.longitude is not distinct from p_longitude
     and cur.order_number = v_order then
    return cur.status;
  end if;

  -- Toute modification remet le profil en validation et rend le cabinet indisponible.
  v_status := case when cur.status = 'suspended' then 'suspended'::public.dentist_status
                   else 'pending'::public.dentist_status end;
  begin
    update public.dentists set
      full_name = v_full, clinic_name = v_clinic, address = v_addr, zone_id = p_zone_id,
      phone = v_phone, latitude = p_latitude, longitude = p_longitude, order_number = v_order,
      status = v_status, available_until = null, updated_at = now()
    where id = v_uid;
  exception when unique_violation then
    raise exception 'registration_used';
  end;
  perform public._audit('profile_updated', v_uid, v_uid);
  return v_status;
end;
$$;

-- ---------- Admin ----------
create or replace function public.admin_set_dentist_status(
  p_dentist uuid, p_status public.dentist_status, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  perform public.expire_stale_requests();
  if p_status = 'pending' then raise exception 'invalid_input'; end if;
  if not exists (select 1 from public.dentists where id = p_dentist) then
    raise exception 'dentist_not_found';
  end if;
  -- L'admin ne peut pas interrompre une demande active.
  if public._has_active_request(p_dentist) then raise exception 'busy'; end if;

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

create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  perform public._require_admin();
  perform public.expire_stale_requests();
  select jsonb_build_object(
    'dentists', coalesce((select jsonb_object_agg(status, n) from (
                  select status, count(*) n from public.dentists group by status) s), '{}'::jsonb),
    'available_now', (select count(*) from public.dentists d
                       where d.status = 'approved' and d.available_until > now()
                         and not public._has_active_request(d.id)),
    'active_requests', (select count(*) from public.requests
                         where status in ('pending', 'accepted', 'arrived')),
    'requests_24h', coalesce((select jsonb_object_agg(status, n) from (
                  select status, count(*) n from public.requests
                   where created_at > now() - interval '24 hours' group by status) s), '{}'::jsonb)
  ) into res;
  return res;
end;
$$;

create or replace function public.admin_audit()
returns table (id bigint, at timestamptz, action text, clinic_name text, zone_id text)
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  perform public.expire_stale_requests();
  return query
    select a.id, a.at, a.action, d.clinic_name, d.zone_id
      from public.audit_events a
      left join public.dentists d on d.id = a.dentist_id
     order by a.id desc
     limit 100;
end;
$$;

-- ---------- Droits d'exécution ----------
revoke all on function public._audit(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public._has_active_request(uuid) from public, anon, authenticated;
revoke all on function public.list_my_requests() from public, anon, authenticated;
revoke all on function public.mark_arrived(uuid) from public, anon, authenticated;
revoke all on function public.complete_request(uuid) from public, anon, authenticated;
revoke all on function public.release_request(uuid) from public, anon, authenticated;
revoke all on function public.admin_audit() from public, anon, authenticated;

grant execute on function public.list_my_requests() to authenticated;
grant execute on function public.mark_arrived(uuid) to authenticated;
grant execute on function public.complete_request(uuid) to authenticated;
grant execute on function public.release_request(uuid) to authenticated;
grant execute on function public.admin_audit() to authenticated;
