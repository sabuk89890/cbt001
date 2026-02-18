insert into public.questions (
  id,
  subject,
  prompt,
  question_type,
  options,
  correct_answer,
  answer_key,
  max_score
)
values
  (
    'q-001',
    'Matematika',
    '2 + 2 = ?',
    'multiple-choice',
    '["3", "4", "5", "6"]'::jsonb,
    '4',
    '{"correctAnswer":"4"}'::jsonb,
    10
  ),
  (
    'q-002',
    'PKN',
    'Pilih semua sila yang termasuk nilai kemanusiaan',
    'multiple-choice-complex',
    '["Adil", "Beradab", "Diskriminatif", "Menindas"]'::jsonb,
    '["Adil","Beradab"]',
    '{"correctAnswers":["Adil","Beradab"]}'::jsonb,
    20
  ),
  (
    'q-003',
    'Bahasa Indonesia',
    'Tuliskan ringkasan singkat tentang manfaat membaca',
    'essay',
    '[]'::jsonb,
    'Membaca menambah wawasan dan kemampuan berpikir kritis',
    '{"modelAnswer":"Membaca menambah wawasan dan kemampuan berpikir kritis","keywords":["wawasan","berpikir kritis","informasi"],"minKeywordMatch":1,"allowManualReview":true}'::jsonb,
    30
  ),
  (
    'q-004',
    'IPA',
    'Air mendidih pada 100°C pada tekanan 1 atm.',
    'true-false',
    '["Benar", "Salah"]'::jsonb,
    'Benar',
    '{"correctAnswer":true}'::jsonb,
    10
  ),
  (
    'q-005',
    'Geografi',
    'Jodohkan negara dengan ibukotanya',
    'matching',
    '["Indonesia", "Jepang", "Thailand"]'::jsonb,
    '[{"left":"Indonesia","right":"Jakarta"}]',
    '{"pairs":[{"left":"Indonesia","right":"Jakarta"},{"left":"Jepang","right":"Tokyo"},{"left":"Thailand","right":"Bangkok"}]}'::jsonb,
    30
  )
on conflict (id) do update
set
  subject = excluded.subject,
  prompt = excluded.prompt,
  question_type = excluded.question_type,
  options = excluded.options,
  correct_answer = excluded.correct_answer,
  answer_key = excluded.answer_key,
  max_score = excluded.max_score;

insert into public.exam_sessions (id, title)
values
  ('demo-session', 'Demo CBT Session')
on conflict (id) do nothing;
