-- =====================================================================
-- TawaDent - schéma V1
-- Toute écriture passe par des fonctions SQL (security definer) :
-- le navigateur n'a AUCUN droit d'écriture direct sur les tables.
-- =====================================================================

-- ---------- Types ----------
create type public.app_role as enum ('patient', 'dentist', 'admin');
create type public.dentist_status as enum ('pending', 'approved', 'suspended', 'rejected');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');

-- ---------- Tables ----------
create table public.zones (
  id text primary key,
  name_fr text not null,
  name_ar text not null,
  sort_order int not null default 0
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'patient',
  created_at timestamptz not null default now()
);

create table public.dentists (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  clinic_name text not null check (char_length(clinic_name) between 2 and 120),
  address text not null check (char_length(address) between 5 and 250),
  zone_id text not null references public.zones (id),
  phone text not null check (phone ~ '^[0-9+ ()-]{6,30}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  order_number text not null check (char_length(order_number) between 2 and 60),
  status public.dentist_status not null default 'pending',
  status_note text,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dentists_zone_idx on public.dentists (zone_id, status);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  dentist_id uuid not null references public.dentists (id) on delete cascade,
  zone_id text not null references public.zones (id),
  patient_first_name text not null check (char_length(patient_first_name) between 1 and 60),
  patient_phone text check (patient_phone ~ '^[0-9+ ()-]{6,30}$'),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz
);
-- Un cabinet = une seule demande en attente. Un patient = une seule demande en attente.
create unique index requests_one_pending_per_dentist on public.requests (dentist_id) where status = 'pending';
create unique index requests_one_pending_per_patient on public.requests (patient_id) where status = 'pending';
create index requests_patient_idx on public.requests (patient_id, created_at desc);
create index requests_dentist_idx on public.requests (dentist_id, created_at desc);

create table public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles (id),
  dentist_id uuid not null references public.dentists (id) on delete cascade,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Zone pilote ----------
insert into public.zones (id, name_fr, name_ar, sort_order) values
  ('ariana',            'Ariana',                 'أريانة',                    1),
  ('ennasr',            'Ennasr',                 'النصر',                     2),
  ('el-menzah',         'El Menzah',              'المنزه',                    3),
  ('el-manar',          'El Manar',               'المنار',                    4),
  ('centre-urbain-nord','Centre Urbain Nord',     'المركز العمراني الشمالي',   5),
  ('lac-1',             'Lac 1',                  'البحيرة 1',                 6),
  ('lac-2',             'Lac 2',                  'البحيرة 2',                 7),
  ('jardins-de-carthage','Jardins de Carthage',   'حدائق قرطاج',               8),
  ('ain-zaghouan',      'Aïn Zaghouan',           'عين زغوان',                 9),
  ('carthage',          'Carthage',               'قرطاج',                    10),
  ('la-marsa',          'La Marsa',               'المرسى',                   11),
  ('sidi-bou-said',     'Sidi Bou Saïd',          'سيدي بوسعيد',              12),
  ('gammarth',          'Gammarth',               'قمرت',                     13),
  ('la-soukra',         'La Soukra',              'السكرة',                   14),
  ('el-aouina',         'El Aouina',              'العوينة',                  15);

-- ---------- Fonctions internes ----------
create or replace function public.auth_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Un compte créé via l'application reçoit un profil. Le rôle admin
-- ne peut JAMAIS être obtenu par ce chemin : il s'attribue à la main.
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Délai de 60 s : toute demande dépassée passe à "expired" côté serveur.
-- Politique V1 : un cabinet qui laisse expirer une demande sans répondre
-- est remis hors disponibilité (il doit se déclarer disponible à nouveau).
create or replace function public.expire_stale_requests()
returns void
language sql security definer set search_path = public as $$
  with exp as (
    update public.requests
       set status = 'expired'
     where status = 'pending' and expires_at <= now()
    returning dentist_id
  )
  update public.dentists d
     set available_until = null, updated_at = now()
   where d.id in (select dentist_id from exp);
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
    'seconds_left',
      case when r.status = 'pending'
           then greatest(0, ceil(extract(epoch from (r.expires_at - now()))))::int
           else 0 end
  );

  -- Les coordonnées ne sont révélées qu'après acceptation.
  if r.status = 'accepted' then
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

-- ---------- Fonctions publiques : patient ----------
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
        where r.dentist_id = d.id and r.status = 'pending' and r.expires_at > now()
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

  -- Anti-abus : 5 demandes par heure et par patient.
  select count(*) into v_recent
    from public.requests
   where patient_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'rate_limited'; end if;

  if exists (select 1 from public.requests where patient_id = v_uid and status = 'pending') then
    raise exception 'patient_has_active_request';
  end if;

  -- Verrou sur la ligne du cabinet : deux patients simultanés sont sérialisés.
  select d.zone_id into v_zone
    from public.dentists d
   where d.id = p_dentist and d.status = 'approved' and d.available_until > now()
   for update;
  if not found then raise exception 'clinic_unavailable'; end if;

  if exists (select 1 from public.requests where dentist_id = p_dentist and status = 'pending') then
    raise exception 'clinic_busy';
  end if;

  begin
    insert into public.requests (patient_id, dentist_id, zone_id, patient_first_name, patient_phone, expires_at)
    values (v_uid, p_dentist, v_zone, v_name, v_phone, now() + interval '60 seconds')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'clinic_busy';
  end;

  return v_id;
end;
$$;

create or replace function public.get_request(p_request uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();
  select * into r from public.requests where id = p_request and patient_id = auth.uid();
  if not found then raise exception 'request_not_found'; end if;
  return public._request_json(r);
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
     and status in ('pending', 'accepted')
     and created_at > now() - interval '3 hours'
   order by created_at desc
   limit 1;
  if not found then return null; end if;
  return public._request_json(r);
end;
$$;

create or replace function public.cancel_request(p_request uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();
  select * into r from public.requests where id = p_request and patient_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status <> 'pending' then return r.status::text; end if;
  update public.requests set status = 'cancelled', responded_at = now() where id = r.id;
  return 'cancelled';
end;
$$;

-- ---------- Fonctions publiques : dentiste ----------
create or replace function public.save_dentist_profile(
  p_full_name text, p_clinic_name text, p_address text, p_zone_id text,
  p_phone text, p_latitude double precision, p_longitude double precision, p_order_number text
) returns public.dentist_status
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  cur public.dentists;
  v_status public.dentist_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'dentist' then raise exception 'not_a_dentist'; end if;

  select * into cur from public.dentists where id = v_uid for update;
  if not found then
    insert into public.dentists (id, full_name, clinic_name, address, zone_id, phone, latitude, longitude, order_number)
    values (v_uid, btrim(p_full_name), btrim(p_clinic_name), btrim(p_address), p_zone_id,
            btrim(p_phone), p_latitude, p_longitude, btrim(p_order_number));
    return 'pending';
  end if;

  v_status := cur.status;
  -- Changement du numéro d'Ordre ou profil refusé : nouvelle validation nécessaire.
  if cur.status = 'rejected' or cur.order_number <> btrim(p_order_number) then
    if cur.status <> 'suspended' then v_status := 'pending'; end if;
  end if;

  update public.dentists set
    full_name = btrim(p_full_name),
    clinic_name = btrim(p_clinic_name),
    address = btrim(p_address),
    zone_id = p_zone_id,
    phone = btrim(p_phone),
    latitude = p_latitude,
    longitude = p_longitude,
    order_number = btrim(p_order_number),
    status = v_status,
    available_until = case when v_status = 'approved' then cur.available_until else null end,
    updated_at = now()
  where id = v_uid;
  return v_status;
end;
$$;

-- Active (true) la disponibilité pour 60 minutes, ou la coupe (false).
create or replace function public.set_availability(p_active boolean)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'dentist' then raise exception 'not_a_dentist'; end if;
  if not exists (select 1 from public.dentists where id = auth.uid() and status = 'approved') then
    raise exception 'dentist_not_approved';
  end if;
  v_until := case when p_active then now() + interval '60 minutes' else null end;
  update public.dentists set available_until = v_until, updated_at = now() where id = auth.uid();
  return v_until;
end;
$$;

create or replace function public.dentist_requests()
returns table (
  id uuid, status public.request_status, patient_first_name text, patient_phone text,
  zone_id text, created_at timestamptz, expires_at timestamptz, responded_at timestamptz,
  seconds_left int
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();
  return query
    select r.id, r.status, r.patient_first_name, r.patient_phone, r.zone_id,
           r.created_at, r.expires_at, r.responded_at,
           case when r.status = 'pending'
                then greatest(0, ceil(extract(epoch from (r.expires_at - now()))))::int
                else 0 end
      from public.requests r
     where r.dentist_id = auth.uid()
     order by r.created_at desc
     limit 30;
end;
$$;

-- Accepter ou refuser. Une acceptation consomme la disponibilité du cabinet.
create or replace function public.respond_request(p_request uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.expire_stale_requests();

  select * into r from public.requests where id = p_request and dentist_id = auth.uid() for update;
  if not found then raise exception 'request_not_found'; end if;
  if r.status <> 'pending' then return r.status::text; end if;  -- expired, cancelled, ...

  if p_accept then
    if not exists (select 1 from public.dentists where id = auth.uid() and status = 'approved') then
      raise exception 'dentist_not_approved';
    end if;
    update public.requests set status = 'accepted', responded_at = now() where id = r.id;
    update public.dentists set available_until = null, updated_at = now() where id = auth.uid();
    return 'accepted';
  else
    update public.requests set status = 'declined', responded_at = now() where id = r.id;
    return 'declined';
  end if;
end;
$$;

-- ---------- Fonctions publiques : admin ----------
create or replace function public._require_admin()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(public.auth_role()::text, '') <> 'admin' then raise exception 'not_admin'; end if;
end;
$$;

create or replace function public.admin_list_dentists(p_status public.dentist_status default null)
returns table (
  id uuid, email text, full_name text, clinic_name text, address text, zone_id text,
  phone text, order_number text, status public.dentist_status, status_note text,
  available_until timestamptz, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
    select d.id, u.email::text, d.full_name, d.clinic_name, d.address, d.zone_id,
           d.phone, d.order_number, d.status, d.status_note, d.available_until, d.created_at
      from public.dentists d
      join auth.users u on u.id = d.id
     where p_status is null or d.status = p_status
     order by (d.status = 'pending') desc, d.created_at desc;
end;
$$;

create or replace function public.admin_set_dentist_status(
  p_dentist uuid, p_status public.dentist_status, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  update public.dentists
     set status = p_status,
         status_note = nullif(btrim(coalesce(p_note, '')), ''),
         available_until = case when p_status = 'approved' then available_until else null end,
         updated_at = now()
   where id = p_dentist;
  if not found then raise exception 'dentist_not_found'; end if;
  insert into public.admin_actions (admin_id, dentist_id, action, note)
  values (auth.uid(), p_dentist, p_status::text, nullif(btrim(coalesce(p_note, '')), ''));
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
    'available_now', (select count(*) from public.dentists
                       where status = 'approved' and available_until > now()),
    'requests_24h', coalesce((select jsonb_object_agg(status, n) from (
                  select status, count(*) n from public.requests
                   where created_at > now() - interval '24 hours' group by status) s), '{}'::jsonb)
  ) into res;
  return res;
end;
$$;

create or replace function public.admin_recent_requests()
returns table (
  id uuid, created_at timestamptz, status public.request_status,
  clinic_name text, zone_id text, response_seconds numeric
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  perform public.expire_stale_requests();
  return query
    select r.id, r.created_at, r.status, d.clinic_name, r.zone_id,
           round(extract(epoch from (r.responded_at - r.created_at))::numeric, 1)
      from public.requests r
      join public.dentists d on d.id = r.dentist_id
     order by r.created_at desc
     limit 50;
end;
$$;

-- ---------- Sécurité : lecture seule via RLS, écriture uniquement par fonctions ----------
alter table public.zones enable row level security;
alter table public.profiles enable row level security;
alter table public.dentists enable row level security;
alter table public.requests enable row level security;
alter table public.admin_actions enable row level security;

create policy zones_read on public.zones for select to anon, authenticated using (true);
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.auth_role() = 'admin');
create policy dentists_read on public.dentists for select to authenticated
  using (id = auth.uid() or public.auth_role() = 'admin');
create policy requests_read on public.requests for select to authenticated
  using (patient_id = auth.uid() or dentist_id = auth.uid() or public.auth_role() = 'admin');
create policy admin_actions_read on public.admin_actions for select to authenticated
  using (public.auth_role() = 'admin');

revoke all on all tables in schema public from anon, authenticated;
grant select on public.zones to anon, authenticated;
grant select on public.profiles, public.dentists, public.requests, public.admin_actions to authenticated;

-- Fonctions : rien n'est exécutable par défaut, on ouvre explicitement.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.list_available_clinics(text) to anon, authenticated;
grant execute on function public.create_request(uuid, text, text) to authenticated;
grant execute on function public.get_request(uuid) to authenticated;
grant execute on function public.get_my_latest_request() to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
grant execute on function public.save_dentist_profile(text, text, text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.set_availability(boolean) to authenticated;
grant execute on function public.dentist_requests() to authenticated;
grant execute on function public.respond_request(uuid, boolean) to authenticated;
grant execute on function public.admin_list_dentists(public.dentist_status) to authenticated;
grant execute on function public.admin_set_dentist_status(uuid, public.dentist_status, text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_recent_requests() to authenticated;

-- ---------- Temps réel ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests') then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
