export const QUESTION_TYPES = [
  "multiple-choice",
  "multiple-choice-complex",
  "essay",
  "true-false",
  "matching",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

type Pair = {
  left: string;
  right: string;
};

type TrueFalseStatement = {
  text: string;
  isTrue: boolean;
};

export type QuestionPayload = {
  id?: string;
  bankId?: string;
  subject?: string;
  prompt?: string;
  questionType?: string;
  options?: unknown;
  correctAnswer?: unknown;
  answerKey?: unknown;
  maxScore?: unknown;
};

export type NormalizedQuestion = {
  id: string;
  bankId: string | null;
  subject: string | null;
  prompt: string;
  questionType: QuestionType;
  options: string[];
  answerKey: Record<string, unknown>;
  maxScore: number;
  legacyCorrectAnswer: string;
};

export type QuestionRow = {
  id: string;
  bank_id?: string | null;
  subject: string | null;
  prompt: string;
  question_type: QuestionType;
  options: string[];
  answer_key: Record<string, unknown>;
  max_score: number;
  correct_answer: string;
};

export type GradingDetail = {
  questionId: string;
  questionType: QuestionType;
  maxScore: number;
  submittedAnswer: unknown;
  autoScore: number;
  manualScore: number | null;
  finalScore: number;
  isAutoCorrect: boolean;
  needsManualReview: boolean;
  notes?: string;
};

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

function normalizeLines(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.round(n);
}

function parseBooleanAnswer(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "benar", "b"].includes(normalized)) {
    return true;
  }

  if (["false", "salah", "s"].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeMatchingPairs(input: unknown): Pair[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const left = "left" in item && typeof item.left === "string" ? item.left.trim() : "";
      const right = "right" in item && typeof item.right === "string" ? item.right.trim() : "";

      if (!left || !right) {
        return null;
      }

      return { left, right };
    })
    .filter((item): item is Pair => item !== null);
}

function normalizeTrueFalseStatements(input: unknown): TrueFalseStatement[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const text = "text" in item && typeof item.text === "string" ? item.text.trim() : "";
      const answerValue = "isTrue" in item ? item.isTrue : "answer" in item ? item.answer : null;
      const parsed = parseBooleanAnswer(answerValue);

      if (!text || parsed === null) {
        return null;
      }

      return { text, isTrue: parsed };
    })
    .filter((item): item is TrueFalseStatement => item !== null);
}

export function normalizeQuestionPayload(body: QuestionPayload):
  | { ok: true; data: NormalizedQuestion }
  | { ok: false; error: string } {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const bankId = typeof body.bankId === "string" ? body.bankId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";

  if (!id || !prompt) {
    return { ok: false, error: "Payload soal tidak lengkap" };
  }

  const questionType: QuestionType = isQuestionType(body.questionType)
    ? body.questionType
    : "multiple-choice";

  const maxScore = toPositiveInt(body.maxScore, 1);

  // extract optional imageUrl (used by all question types)
  const imageUrl =
    typeof (body.answerKey as { imageUrl?: unknown })?.imageUrl === "string"
      ? String((body.answerKey as { imageUrl: string }).imageUrl).trim()
      : "";

  if (questionType === "multiple-choice") {
    const options = unique(normalizeLines(body.options));
    const correctAnswer =
      typeof body.correctAnswer === "string"
        ? body.correctAnswer.trim()
        : typeof (body.answerKey as { correctAnswer?: unknown })?.correctAnswer === "string"
          ? String((body.answerKey as { correctAnswer: string }).correctAnswer).trim()
          : "";

    if (options.length < 2) {
      return { ok: false, error: "Pilihan ganda minimal memiliki 2 opsi" };
    }

    if (!options.includes(correctAnswer)) {
      return { ok: false, error: "Jawaban benar harus ada di daftar opsi" };
    }

    return {
      ok: true,
      data: {
        id,
        bankId: bankId || null,
        subject: subject || null,
        prompt,
        questionType,
        maxScore,
        options,
        answerKey: { correctAnswer, imageUrl },
        legacyCorrectAnswer: correctAnswer,
      },
    };
  }

  if (questionType === "multiple-choice-complex") {
    const options = unique(normalizeLines(body.options));
    const candidateCorrectAnswers = Array.isArray((body.answerKey as { correctAnswers?: unknown })?.correctAnswers)
      ? normalizeLines((body.answerKey as { correctAnswers: unknown[] }).correctAnswers)
      : Array.isArray(body.correctAnswer)
        ? normalizeLines(body.correctAnswer)
        : typeof body.correctAnswer === "string"
          ? unique(
              body.correctAnswer
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            )
          : [];

    const correctAnswers = unique(candidateCorrectAnswers);

    if (options.length !== 4) {
      return { ok: false, error: "Pilihan ganda kompleks harus memiliki tepat 4 opsi" };
    }

    if (correctAnswers.length < 2) {
      return { ok: false, error: "Pilihan ganda kompleks minimal memiliki 2 jawaban benar" };
    }

    if (correctAnswers.some((answer) => !options.includes(answer))) {
      return { ok: false, error: "Semua jawaban benar harus ada di daftar opsi" };
    }

    return {
      ok: true,
      data: {
        id,
        bankId: bankId || null,
        subject: subject || null,
        prompt,
        questionType,
        maxScore,
        options,
        answerKey: { correctAnswers, imageUrl },
        legacyCorrectAnswer: JSON.stringify(correctAnswers),
      },
    };
  }

  if (questionType === "true-false") {
    const statements = normalizeTrueFalseStatements(
      (body.answerKey as { statements?: unknown })?.statements
    );

    if (statements.length > 0) {
      return {
        ok: true,
        data: {
          id,
          bankId: bankId || null,
          subject: subject || null,
          prompt,
          questionType,
          maxScore,
          options: statements.map((item) => item.text),
          answerKey: { statements, imageUrl },
          legacyCorrectAnswer: JSON.stringify(statements),
        },
      };
    }

    const parsed = parseBooleanAnswer(
      typeof body.correctAnswer !== "undefined"
        ? body.correctAnswer
        : (body.answerKey as { correctAnswer?: unknown })?.correctAnswer
    );

    if (parsed === null) {
      return { ok: false, error: "Jawaban benar untuk benar/salah harus berupa benar atau salah" };
    }

    return {
      ok: true,
      data: {
        id,
        bankId: bankId || null,
        subject: subject || null,
        prompt,
        questionType,
        maxScore,
        options: ["Benar", "Salah"],
        answerKey: { correctAnswer: parsed, imageUrl },
        legacyCorrectAnswer: parsed ? "Benar" : "Salah",
      },
    };
  }

  if (questionType === "essay") {
    const modelAnswer =
      typeof body.correctAnswer === "string"
        ? body.correctAnswer.trim()
        : typeof (body.answerKey as { modelAnswer?: unknown })?.modelAnswer === "string"
          ? String((body.answerKey as { modelAnswer: string }).modelAnswer).trim()
          : "";

    const keywords = unique(
      Array.isArray((body.answerKey as { keywords?: unknown })?.keywords)
        ? normalizeLines((body.answerKey as { keywords: unknown[] }).keywords)
        : []
    );

    const minKeywordMatch = toPositiveInt(
      (body.answerKey as { minKeywordMatch?: unknown })?.minKeywordMatch,
      1
    );

    const acceptedAnswers = unique(
      modelAnswer
        .split("/")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    );

    const imageUrl =
      typeof (body.answerKey as { imageUrl?: unknown })?.imageUrl === "string"
        ? String((body.answerKey as { imageUrl: string }).imageUrl).trim()
        : "";

    if (!modelAnswer) {
      return { ok: false, error: "Soal essay wajib memiliki model jawaban" };
    }

    return {
      ok: true,
      data: {
        id,
        bankId: bankId || null,
        subject: subject || null,
        prompt,
        questionType,
        maxScore,
        options: [],
        answerKey: {
          modelAnswer,
          acceptedAnswers,
          keywords,
          minKeywordMatch,
          imageUrl,
          allowManualReview: acceptedAnswers.length === 0,
        },
        legacyCorrectAnswer: modelAnswer,
      },
    };
  }

  if (questionType === "matching") {
    const pairs = normalizeMatchingPairs(
      (body.answerKey as { pairs?: unknown })?.pairs ?? body.options
    );

    if (pairs.length < 2) {
      return { ok: false, error: "Soal menjodohkan minimal memiliki 2 pasangan" };
    }

    const uniqueLeft = unique(pairs.map((pair) => pair.left));
    if (uniqueLeft.length !== pairs.length) {
      return { ok: false, error: "Bagian kiri pada soal menjodohkan tidak boleh duplikat" };
    }

    return {
      ok: true,
      data: {
        id,
        bankId: bankId || null,
        subject: subject || null,
        prompt,
        questionType,
        maxScore,
        options: pairs.map((pair) => pair.left),
        answerKey: { pairs, imageUrl },
        legacyCorrectAnswer: JSON.stringify(pairs),
      },
    };
  }

  return { ok: false, error: "Tipe soal tidak didukung" };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function setEquals(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

export function gradeQuestion(question: QuestionRow, submittedAnswer: unknown): GradingDetail {
  const questionType = question.question_type;
  const maxScore = toPositiveInt(question.max_score, 1);

  if (questionType === "multiple-choice") {
    const expected = asString((question.answer_key as { correctAnswer?: unknown }).correctAnswer);
    const answer = asString(submittedAnswer);
    const isCorrect = answer.length > 0 && answer === expected;
    const score = isCorrect ? maxScore : 0;

    return {
      questionId: question.id,
      questionType,
      maxScore,
      submittedAnswer,
      autoScore: score,
      manualScore: null,
      finalScore: score,
      isAutoCorrect: true,
      needsManualReview: false,
    };
  }

  if (questionType === "multiple-choice-complex") {
    const expected = unique(
      normalizeLines((question.answer_key as { correctAnswers?: unknown }).correctAnswers)
    );
    const selected = unique(normalizeLines(Array.isArray(submittedAnswer) ? submittedAnswer : []));

    const truePositive = selected.filter((item) => expected.includes(item)).length;
    const falsePositive = selected.filter((item) => !expected.includes(item)).length;
    const base = expected.length > 0 ? truePositive / expected.length : 0;
    const penalty = expected.length > 0 ? falsePositive / expected.length : 0;
    const ratio = clamp(base - penalty, 0, 1);
    const score = Math.round(ratio * maxScore);

    return {
      questionId: question.id,
      questionType,
      maxScore,
      submittedAnswer,
      autoScore: score,
      manualScore: null,
      finalScore: score,
      isAutoCorrect: true,
      needsManualReview: false,
      notes: setEquals(selected, expected) ? "Jawaban lengkap benar" : undefined,
    };
  }

  if (questionType === "true-false") {
    const statements = normalizeTrueFalseStatements(
      (question.answer_key as { statements?: unknown }).statements
    );

    if (statements.length > 0) {
      const submittedStatements = normalizeTrueFalseStatements(submittedAnswer);
      const expectedMap = new Map(statements.map((item) => [item.text, item.isTrue]));
      const submittedMap = new Map(submittedStatements.map((item) => [item.text, item.isTrue]));
      const correctCount = statements.filter((item) => submittedMap.get(item.text) === item.isTrue).length;
      const ratio = statements.length > 0 ? correctCount / statements.length : 0;
      const score = Math.round(clamp(ratio, 0, 1) * maxScore);

      return {
        questionId: question.id,
        questionType,
        maxScore,
        submittedAnswer,
        autoScore: score,
        manualScore: null,
        finalScore: score,
        isAutoCorrect: true,
        needsManualReview: false,
      };
    }

    const expected = parseBooleanAnswer((question.answer_key as { correctAnswer?: unknown }).correctAnswer);
    const answer = parseBooleanAnswer(submittedAnswer);
    const isCorrect = answer !== null && expected !== null && answer === expected;
    const score = isCorrect ? maxScore : 0;

    return {
      questionId: question.id,
      questionType,
      maxScore,
      submittedAnswer,
      autoScore: score,
      manualScore: null,
      finalScore: score,
      isAutoCorrect: true,
      needsManualReview: false,
    };
  }

  if (questionType === "essay") {
    const modelAnswer = asString((question.answer_key as { modelAnswer?: unknown }).modelAnswer);
    const acceptedAnswers = unique(
      normalizeLines((question.answer_key as { acceptedAnswers?: unknown }).acceptedAnswers)
        .map((item) => item.toLowerCase())
    );
    const keywords = unique(
      normalizeLines((question.answer_key as { keywords?: unknown }).keywords)
        .map((item) => item.toLowerCase())
    );

    const studentText = asString(submittedAnswer).toLowerCase();

    if (acceptedAnswers.length > 0) {
      const isCorrect = studentText.length > 0 && acceptedAnswers.includes(studentText);
      const score = isCorrect ? maxScore : 0;

      return {
        questionId: question.id,
        questionType,
        maxScore,
        submittedAnswer,
        autoScore: score,
        manualScore: null,
        finalScore: score,
        isAutoCorrect: true,
        needsManualReview: false,
        notes: "Essay auto-grade berdasarkan kunci jawaban dipisah '/'",
      };
    }

    let ratio = 0;

    if (studentText.length > 0 && keywords.length > 0) {
      const matched = keywords.filter((keyword) => studentText.includes(keyword)).length;
      ratio = matched / keywords.length;
    } else if (studentText.length > 0 && modelAnswer) {
      const modelTokens = unique(
        modelAnswer
          .toLowerCase()
          .split(/\s+/)
          .map((item) => item.replace(/[^a-z0-9]/gi, ""))
          .filter((item) => item.length >= 3)
      );

      if (modelTokens.length > 0) {
        const matched = modelTokens.filter((token) => studentText.includes(token)).length;
        ratio = matched / modelTokens.length;
      }
    }

    const score = Math.round(clamp(ratio, 0, 1) * maxScore);

    return {
      questionId: question.id,
      questionType,
      maxScore,
      submittedAnswer,
      autoScore: score,
      manualScore: null,
      finalScore: score,
      isAutoCorrect: true,
      needsManualReview: true,
      notes: "Essay diberi skor otomatis dan tetap dapat dikoreksi manual",
    };
  }

  const pairs = normalizeMatchingPairs((question.answer_key as { pairs?: unknown }).pairs);
  const submittedPairs = normalizeMatchingPairs(submittedAnswer);

  const answerMap = new Map(pairs.map((pair) => [pair.left, pair.right]));
  const total = answerMap.size;
  const correct = submittedPairs.filter((pair) => answerMap.get(pair.left) === pair.right).length;
  const ratio = total > 0 ? correct / total : 0;
  const score = Math.round(clamp(ratio, 0, 1) * maxScore);

  return {
    questionId: question.id,
    questionType: "matching",
    maxScore,
    submittedAnswer,
    autoScore: score,
    manualScore: null,
    finalScore: score,
    isAutoCorrect: true,
    needsManualReview: false,
  };
}

export function computeStatusFromPercentage(percentage: number) {
  return percentage >= 75 ? "Lulus" : "Remedial";
}

export function calculatePercentage(totalScore: number, totalMaxScore: number) {
  if (totalMaxScore <= 0) {
    return 0;
  }

  const raw = Math.round((totalScore / totalMaxScore) * 100);
  // ensure percentage is within 0-100 even if scores exceed expected max
  return clamp(raw, 0, 100);
}
