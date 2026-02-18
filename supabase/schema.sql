create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'guru', 'student')),
  username text,
  full_name text,
  class_name text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists class_name text;

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  add column if not exists photo_url text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('admin', 'guru', 'student'));
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_key'
  ) then
    alter table public.profiles
      add constraint profiles_username_key unique (username);
  end if;
end $$;

create table if not exists public.questions (
  id text primary key,
  subject text,
  prompt text not null,
  question_type text not null default 'multiple-choice',
  options jsonb not null,
  correct_answer text not null,
  answer_key jsonb not null default '{}'::jsonb,
  max_score int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  target_classes text[] not null default '{}'::text[],
  owner_teacher_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists question_banks_owner_teacher_idx
  on public.question_banks (owner_teacher_id);

create index if not exists question_banks_created_at_idx
  on public.question_banks (created_at desc);

create unique index if not exists subjects_name_lower_key
  on public.subjects (lower(name));

alter table public.questions
  add column if not exists question_type text not null default 'multiple-choice';

alter table public.question_banks
  add column if not exists target_classes text[] not null default '{}'::text[];

alter table public.questions
  add column if not exists bank_id uuid references public.question_banks(id) on delete set null;

alter table public.questions
  add column if not exists answer_key jsonb not null default '{}'::jsonb;

alter table public.questions
  add column if not exists max_score int not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_question_type_check'
  ) then
    alter table public.questions
      add constraint questions_question_type_check
      check (question_type in ('multiple-choice', 'multiple-choice-complex', 'essay', 'true-false', 'matching'));
  end if;
end $$;

create table if not exists public.exam_sessions (
  id text primary key,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.exam_sessions(id) on delete cascade,
  student_id uuid,
  answers jsonb not null,
  score int not null,
  status text not null,
  auto_score int not null default 0,
  manual_adjustment int not null default 0,
  grading_detail jsonb not null default '[]'::jsonb,
  needs_manual_review boolean not null default false,
  review_status text not null default 'auto',
  reviewed_by text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.exam_submissions
  add column if not exists auto_score int not null default 0;

alter table public.exam_submissions
  add column if not exists manual_adjustment int not null default 0;

alter table public.exam_submissions
  add column if not exists grading_detail jsonb not null default '[]'::jsonb;

alter table public.exam_submissions
  add column if not exists needs_manual_review boolean not null default false;

alter table public.exam_submissions
  add column if not exists review_status text not null default 'auto';

alter table public.exam_submissions
  add column if not exists reviewed_by text;

alter table public.exam_submissions
  add column if not exists review_note text;

alter table public.exam_submissions
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exam_submissions_review_status_check'
  ) then
    alter table public.exam_submissions
      add constraint exam_submissions_review_status_check
      check (review_status in ('auto', 'reviewed'));
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.subjects enable row level security;
alter table public.question_banks enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_submissions enable row level security;

create policy "students can read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "authenticated users can read questions"
on public.questions
for select
to authenticated
using (true);

create policy "authenticated users can read subjects"
on public.subjects
for select
to authenticated
using (true);

create policy "authenticated users can read question banks"
on public.question_banks
for select
to authenticated
using (true);
