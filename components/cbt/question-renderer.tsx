"use client";

import type { ExamQuestion, MatchingQuestionUIProps } from "@/lib/cbt/types";
import { getRandomColor } from "../../lib/utils/color";
import { useRef, useState } from "react";

type Pair = { left: string; right: string };
type TrueFalseStatement = { text: string; isTrue: boolean };

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

function normalizeTrueFalseStatements(input: unknown): TrueFalseStatement[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const text = "text" in item && typeof item.text === "string" ? item.text : "";
      const answerValue = "isTrue" in item ? item.isTrue : "answer" in item ? item.answer : null;
      const isTrue =
        answerValue === true ||
        answerValue === "Benar" ||
        answerValue === "benar" ||
        answerValue === "true";
      const isFalse =
        answerValue === false ||
        answerValue === "Salah" ||
        answerValue === "salah" ||
        answerValue === "false";

      if (!text || (!isTrue && !isFalse)) {
        return null;
      }

      return { text, isTrue };
    })
    .filter((item): item is TrueFalseStatement => item !== null);
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

                  type MatchingQuestionUIProps = { question: ExamQuestion; value: unknown; onChange?: (v: unknown) => void; readOnly?: boolean };
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
        normalizeTrueFalseStatements(question.answerKey.statements).length > 0 ? (
          <div className="space-y-2">
            {normalizeTrueFalseStatements(question.answerKey.statements).map((statement) => {
              const currentAnswers = normalizeTrueFalseStatements(value);
              const selected = currentAnswers.find((item) => item.text === statement.text);

              return (
                <div key={statement.text} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
                  <p className="rounded-md border px-3 py-2 text-sm">{statement.text}</p>
                  <select
                    value={selected ? (selected.isTrue ? "Benar" : "Salah") : ""}
                    disabled={readOnly}
                    onChange={(event) => {
                      const current = normalizeTrueFalseStatements(value).filter(
                        (item) => item.text !== statement.text
                      );

                      const next = event.target.value
                        ? [
                            ...current,
                            {
                              text: statement.text,
                              answer: event.target.value,
                            },
                          ]
                        : current;

                      onChange?.(next);
                    }}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Pilih</option>
                    <option value="Benar">Benar</option>
                    <option value="Salah">Salah</option>
                  </select>
                </div>
              );
            })}
          </div>
        ) : (
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
        )
      ) : null}

      {question.questionType === "matching" ? (
        <MatchingQuestionUI
          question={question}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      ) : null}

// --- MatchingQuestionUI ---
// Fungsi harus di luar komponen dan hanya pakai const

const MatchingQuestionUI: React.FC<MatchingQuestionUIProps> = ({ question, value, onChange, readOnly }) => {
  const lefts = normalizePairs(question.answerKey?.pairs ?? []).map((p) => p.left);
  const rights = (question.answerKey?.options && Array.isArray(question.answerKey.options)
    ? normalizeStringList(question.answerKey.options)
    : normalizePairs(question.answerKey?.pairs ?? []).map((p) => p.right));
  const selectedPairs = normalizePairs(value);
  const [pendingLeft, setPendingLeft] = useState<string | null>(null);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Build color map for each pair
  const colorMap: Record<string, string> = {};
  selectedPairs.forEach((pair, idx) => {
    colorMap[pair.left + "-" + pair.right] = getRandomColor(pair.left + "-" + pair.right);
  });

  // SVG lines for connected pairs
  const lines = selectedPairs.map((pair, idx) => {
    const lIdx = lefts.indexOf(pair.left);
    const rIdx = rights.indexOf(pair.right);
    if (lIdx === -1 || rIdx === -1) return null;
    const leftEl = leftRefs.current[lIdx];
    const rightEl = rightRefs.current[rIdx];
    if (!leftEl || !rightEl) return null;
    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    // SVG parent offset
    const svgRect = leftEl.parentElement?.parentElement?.getBoundingClientRect();
    if (!svgRect) return null;
    const y1 = leftRect.top + leftRect.height / 2 - svgRect.top;
    const y2 = rightRect.top + rightRect.height / 2 - svgRect.top;
    const x1 = leftRect.right - svgRect.left;
    const x2 = rightRect.left - svgRect.left;
    const color = colorMap[pair.left + "-" + pair.right] || getRandomColor(pair.left + "-" + pair.right);
    return (
      <line
        key={pair.left + "-" + pair.right}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={4}
        markerEnd="url(#arrow)"
      />
    );
  });

  function handleLeftClick(left: string) {
    if (readOnly) return;
    setPendingLeft(left === pendingLeft ? null : left);
  }
  function handleRightClick(right: string) {
    if (readOnly || !pendingLeft) return;
    // Remove if already paired
    const filtered = selectedPairs.filter((p) => p.left !== pendingLeft && p.right !== right);
    // Remove previous pair for this left
    const withoutLeft = filtered.filter((p) => p.left !== pendingLeft);
    // Add new pair
    const next = [...withoutLeft, { left: pendingLeft, right }];
    setPendingLeft(null);
    onChange?.(next);
  }
  function handleRemovePair(left: string) {
    if (readOnly) return;
    const next = selectedPairs.filter((p) => p.left !== left);
    onChange?.(next);
  }

  return (
    <div style={{ position: "relative" }}>
      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L10,5 L0,10" fill="gray" />
          </marker>
        </defs>
        {lines}
      </svg>
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="space-y-2">
          {lefts.map((left, idx) => {
            const pair = selectedPairs.find((p) => p.left === left);
            const color = pair ? colorMap[pair.left + "-" + pair.right] : undefined;
            return (
              <div
                key={left}
                ref={el => leftRefs.current[idx] = el}
                className={`rounded-md border px-3 py-2 text-sm cursor-pointer select-none flex items-center gap-2 ${pendingLeft === left ? "ring-2 ring-blue-400" : ""}`}
                style={{ background: color || undefined, borderColor: color || undefined, opacity: pair ? 0.95 : 1 }}
                onClick={() => handleLeftClick(left)}
              >
                <span>{left}</span>
                {pair && !readOnly ? (
                  <button type="button" className="ml-auto text-xs text-red-600" onClick={e => { e.stopPropagation(); handleRemovePair(left); }}>Hapus</button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((right, idx) => {
            const pair = selectedPairs.find((p) => p.right === right);
            const color = pair ? colorMap[pair.left + "-" + pair.right] : undefined;
            return (
              <div
                key={right}
                ref={el => rightRefs.current[idx] = el}
                className={`rounded-md border px-3 py-2 text-sm cursor-pointer select-none ${pair ? "opacity-95" : ""}`}
                style={{ background: color || undefined, borderColor: color || undefined }}
                onClick={() => handleRightClick(right)}
              >
                <span>{right}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2">Klik kiri lalu klik kanan untuk menjodohkan. Klik "Hapus" untuk membatalkan pasangan.</p>
    </div>
  );
}
    </fieldset>
  );
}
