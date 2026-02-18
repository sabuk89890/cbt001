-- Jalankan setelah user dibuat di Supabase Auth dan baris role sudah ada di public.profiles.
-- Login aplikasi tetap pakai username + password (tanpa input email).

-- 1) Sinkron email profiles dari auth.users (otomatis, tidak perlu input email manual)
update public.profiles as p
set email = u.email
from auth.users as u
where p.id = u.id
  and (p.email is null or p.email <> u.email);

-- 2) Set username admin (ubah sesuai kebutuhan)
update public.profiles
set username = 'burnitelong'
where role = 'admin';

-- 3) Set username siswa (sesuai permintaan Anda)
update public.profiles
set username = 'siswa1'
where role = 'student';

-- 4) Cek hasil
select id, role, username, email, full_name, class_name
from public.profiles
order by created_at desc;
