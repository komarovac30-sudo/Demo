-- V14: public profile trust/details fields.
-- Adds optional creator-supplied appearance/profile details used in the public About section.

alter table public.profiles add column if not exists age smallint;
alter table public.profiles add column if not exists height_label text;
alter table public.profiles add column if not exists body_type text;
alter table public.profiles add column if not exists ethnicity text;
alter table public.profiles add column if not exists hair_color text;
alter table public.profiles add column if not exists eye_color text;
alter table public.profiles add column if not exists measurements text;
alter table public.profiles add column if not exists cup_size text;
alter table public.profiles add column if not exists languages text;
alter table public.profiles add column if not exists tattoos_piercings text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_age_adult_check'
  ) then
    alter table public.profiles
      add constraint profiles_age_adult_check check (age is null or (age between 18 and 99));
  end if;
end $$;

-- The existing profile update privilege is column-scoped. Add these new public presentation fields.
grant update(age,height_label,body_type,ethnicity,hair_color,eye_color,measurements,cup_size,languages,tattoos_piercings)
  on public.profiles to authenticated;
