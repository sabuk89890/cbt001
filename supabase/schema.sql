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


-- global key/value settings so administrators can toggle features without
-- needing to modify code or environment variables. the value field is
-- jsonb allowing structured flags such as { "requireExamBrowser": true }.
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists system_settings_key_idx on public.system_settings(key);

create table if not exists public.exam_sessions (
  id text primary key,
  title text,
  created_at timestamptz not null default now()
);

alter table public.exam_sessions
  add column if not exists bank_id uuid references public.question_banks(id) on delete set null;

alter table public.exam_sessions
  add column if not exists starts_at timestamptz;

alter table public.exam_sessions
  add column if not exists duration_minutes int;

alter table public.exam_sessions
  add column if not exists ends_at timestamptz;

alter table public.exam_sessions
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.exam_sessions
  add column if not exists is_active boolean not null default false;

-- token for session access (alphanumeric code). admin can set manually or let system rotate automatically.
-- a session may have zero or one token row. expires_at null means no expiration (manual override).
create table if not exists public.exam_tokens (
  session_id text primary key references public.exam_sessions(id) on delete cascade,
  token text not null,
  expires_at timestamptz,
  refresh_interval int, -- minutes between automatic refresh (null or 0 = no auto)
  manual boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.exam_tokens
  add column if not exists refresh_interval int;

create table if not exists public.exam_participants (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.exam_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz,
  finished_at timestamptz,
  status text not null default 'not_started',
  answers jsonb not null default '{}'::jsonb,
  score numeric,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exam_participants_status_check'
  ) then
    alter table public.exam_participants
      add constraint exam_participants_status_check
      check (status in ('not_started','in_progress','finished','stopped'));
  end if;
end $$;

create table if not exists public.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.exam_sessions(id) on delete cascade,
  participant_id uuid references public.exam_participants(id) on delete cascade,
  question_id text not null references public.questions(id) on delete restrict,
  order_index int,
  shuffled_options jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_questions_session on public.session_questions(session_id);
create index if not exists idx_session_questions_participant on public.session_questions(participant_id);

-- index to speed up participant queries by session and status
create index if not exists idx_exam_participants_session_status on public.exam_participants(session_id, status);

-- view: counts per session per status
create or replace view public.view_session_participant_counts as
select session_id, status, count(*) as cnt
from public.exam_participants
group by session_id, status;

-- rpc: return aggregated metrics for a session as jsonb
create or replace function public.rpc_get_session_metrics(sid text)
returns jsonb as $$
  select jsonb_build_object(
    'in_progress', coalesce(sum(case when status='in_progress' then 1 else 0 end),0),
    'finished', coalesce(sum(case when status='finished' then 1 else 0 end),0),
    'not_started', coalesce(sum(case when status='not_started' then 1 else 0 end),0),
    'stopped', coalesce(sum(case when status='stopped' then 1 else 0 end),0)
  )
  from public.exam_participants
  where session_id = sid;
$$ language sql stable;


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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'students can read own profile'
  ) then
    execute $pol$CREATE POLICY "students can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);$pol$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'questions' and policyname = 'authenticated users can read questions'
  ) then
    execute $pol$CREATE POLICY "authenticated users can read questions" ON public.questions FOR SELECT TO authenticated USING (true);$pol$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subjects' and policyname = 'authenticated users can read subjects'
  ) then
    execute $pol$CREATE POLICY "authenticated users can read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);$pol$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_banks' and policyname = 'authenticated users can read question banks'
  ) then
    execute $pol$CREATE POLICY "authenticated users can read question banks" ON public.question_banks FOR SELECT TO authenticated USING (true);$pol$;
  end if;
end $$;
