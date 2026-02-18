export type Pair = { left: string; right: string };
export type TrueFalseStatement = { text: string; isTrue: boolean };
export type QuestionRendererProps = {
  index: number;
  question: ExamQuestion;
  value: unknown;
  onChange?: (nextValue: unknown) => void;
  readOnly?: boolean;
};
export type MatchingQuestionUIProps = { question: ExamQuestion; value: unknown; onChange?: (v: unknown) => void; readOnly?: boolean };
import type { QuestionType } from "./question-engine";

export type ExamQuestion = {
  id: string;
  bankId?: string | null;
  subject: string | null;
  prompt: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  answerKey: Record<string, unknown>;
  maxScore: number;
};

export type SubmissionReview = {
  id: string;
  sessionId: string;
  studentId: string | null;
  answers: Record<string, unknown>;
  score: number;
  autoScore: number;
  manualAdjustment: number;
  status: string;
  needsManualReview: boolean;
  reviewStatus: string;
  gradingDetail: Array<{
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
  }>;
};
