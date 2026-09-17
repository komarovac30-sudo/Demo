-- OPTIONAL V14 demo profile-detail seed.
-- Safe to skip. This only updates optional public profile-detail fields for @creator.
update public.profiles
set age = 28,
    height_label = '5''6" / 168 cm',
    body_type = 'Curvy',
    ethnicity = 'Mixed',
    hair_color = 'Dark brown • long',
    eye_color = 'Brown',
    measurements = '34-26-36',
    cup_size = 'C',
    languages = 'English • Spanish',
    tattoos_piercings = 'Small tattoos • ears pierced',
    updated_at = now()
where username = 'creator' and role = 'CREATOR';
