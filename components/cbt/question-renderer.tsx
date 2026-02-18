"use client";

import type { ExamQuestion } from "@/lib/cbt/types";

type Pair = { left: string; right: string };

type Props = {
  index: number;
  question: ExamQuestion;
  value: unknown;
  onChange?: (nextValue: unknown) => void;
  readOnly?: boolean;
};

function normalizePairs(input: unknown): Pair[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const left = "left" in item && typeof item.left === "string" ? item.left : "";
      const right = "right" in item && typeof item.right === "string" ? item.right : "";

      if (!left || !right) {
        return null;
      }

      return { left, right };
    })
    .filter((item): item is Pair => item !== null);
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is string => typeof item === "string");
}

export function QuestionRenderer({ index, question, value, onChange, readOnly = false }: Props) {
  const inputName = `q-${question.id}`;
  const imageUrl =
    typeof (question.answerKey as { imageUrl?: unknown })?.imageUrl === "string"
      ? String((question.answerKey as { imageUrl: string }).imageUrl)
      : "";

  return (
    <fieldset className="space-y-2 rounded-lg border p-4">
      <legend className="font-medium">
        {index + 1}. {question.prompt}
      </legend>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Gambar soal ${question.id}`}
          className="max-h-64 w-full rounded-md border object-contain"
        />
      ) : null}
      <p className="text-xs opacity-70">
        {question.questionType} • max {question.maxScore}
      </p>

      {question.questionType === "multiple-choice" ? (
        <div className="space-y-1">
          {question.options.map((option) => {
            const selected = value === option;
            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={inputName}
                  checked={selected}
                  onChange={() => onChange?.(option)}
                  disabled={readOnly}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : null}

      {question.questionType === "multiple-choice-complex" ? (
        <div className="space-y-1">
          {question.options.map((option) => {
            const selected = normalizeStringList(value).includes(option);
            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={readOnly}
                  onChange={(event) => {
                    const current = normalizeStringList(value);
                    const next = event.target.checked
                      ? [...new Set([...current, option])]
                      : current.filter((item) => item !== option);
                    onChange?.(next);
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : null}

      {question.questionType === "essay" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={4}
          placeholder="Tulis jawaban essay"
          readOnly={readOnly}
        />
      ) : null}

      {question.questionType === "true-false" ? (
        <div className="space-y-1">
          {["Benar", "Salah"].map((option) => {
            const selected =
              (typeof value === "boolean" && ((option === "Benar" && value) || (option === "Salah" && !value))) ||
              value === option;

            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={inputName}
                  checked={selected}
                  onChange={() => onChange?.(option)}
                  disabled={readOnly}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : null}

      {question.questionType === "matching" ? (
        <div className="space-y-2">
          {normalizePairs(question.answerKey.pairs).map((pair) => {
            const selectedPairs = normalizePairs(value);
            const selected = selectedPairs.find((item) => item.left === pair.left);
            const rightOptions = normalizePairs(question.answerKey.pairs).map((item) => item.right);

            return (
              <div key={pair.left} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
                <p className="rounded-md border px-3 py-2 text-sm">{pair.left}</p>
                <select
                  value={selected?.right ?? ""}
                  disabled={readOnly}
                  onChange={(event) => {
                    const current = normalizePairs(value).filter((item) => item.left !== pair.left);
                    const next = event.target.value
                      ? [...current, { left: pair.left, right: event.target.value }]
                      : current;
                    onChange?.(next);
                  }}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Pilih pasangan</option>
                  {rightOptions.map((option) => (
                    <option key={`${pair.left}-${option}`} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}
