-- Jalankan setelah user dibuat di Supabase Auth.
-- Login aplikasi memakai username + password (tanpa input email).

-- 1) Pastikan kolom username tersedia
alter table public.profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_key'
  ) then
    alter table public.profiles
      add constraint profiles_username_key unique (username);
  end if;
end $$;

-- 2) Buat profile untuk semua user auth yang belum punya profile
insert into public.profiles (id, role, username, full_name, class_name)
select
  u.id,
  'student',
  'user_' || left(replace(u.id::text, '-', ''), 8),
  coalesce(u.raw_user_meta_data ->> 'full_name', null),
  null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 3) Jadikan 1 akun pertama sebagai admin dan set username admin
update public.profiles
set role = 'admin',
    username = 'burnitelong'
where id = (
  select p.id
  from public.profiles p
  order by p.created_at asc, p.id asc
  limit 1
);

-- 4) Contoh username siswa
update public.profiles
set username = 'siswa1'
where role = 'student'
  and username like 'user_%';

-- 5) Cek hasil
select id, role, username, full_name, class_name
from public.profiles
order by created_at asc;
