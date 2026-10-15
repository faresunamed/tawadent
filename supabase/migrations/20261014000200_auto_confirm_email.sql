-- =====================================================================
-- Mise à jour 3 : plus de validation d'email à l'inscription.
-- Tout nouveau compte est marqué « email confirmé » par la base elle-même
-- (patient, dentiste, admin). La validation des DENTISTES par l'administration
-- (n° d'Ordre) reste, elle, inchangée.
-- À exécuter une fois dans le SQL Editor de Supabase.
-- =====================================================================
create or replace function public._auto_confirm_email()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

drop trigger if exists auto_confirm_email on auth.users;
create trigger auto_confirm_email
  before insert on auth.users
  for each row execute function public._auto_confirm_email();

-- Comptes déjà créés mais jamais confirmés : on les confirme.
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

revoke all on function public._auto_confirm_email() from public, anon, authenticated;
