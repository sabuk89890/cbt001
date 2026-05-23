"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamQuestion } from "@/lib/cbt/types";

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

import MatchingQuestion from "./matching-question";

export function QuestionRenderer({ index, question, value, onChange, readOnly = false }: Props) {
  const inputName = `q-${question.id}`;
  const imageUrl =
    typeof (question.answerKey as { imageUrl?: unknown })?.imageUrl === "string"
      ? String((question.answerKey as { imageUrl: string }).imageUrl)
      : "";

  const [isZoomed, setIsZoomed] = useState(false);
  const [zoom, setZoom] = useState(1);
  // allow closing enlarged image with Escape and reset zoom when closed
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsZoomed(false);
    }
    if (isZoomed) window.addEventListener("keydown", onKey);
    if (!isZoomed) setZoom(1);
    return () => window.removeEventListener("keydown", onKey);
  }, [isZoomed]);

  return (
    <fieldset
      className="space-y-2 rounded-lg border p-4 select-none"
      onCopy={(e) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
      }}
      onCut={(e) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
      }}
      onContextMenu={(e) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
      }}
      // prevent mouse drag selection of non-input areas (allow selects too)
      onMouseDown={(e) => {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' ||
            t.isContentEditable)
        )
          return;
        e.preventDefault();
      }}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x' || e.key === 'a')) {
          e.preventDefault();
        }
      }}
    >
      <legend className="font-medium">
        <span>{index + 1}. </span>
        <span className="whitespace-pre-wrap">{question.prompt}</span>
      </legend>
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={`Gambar soal ${question.id}`}
            className="max-h-64 w-full rounded-md border object-contain cursor-zoom-in"
            onClick={() => setIsZoomed(true)}
          />

          {isZoomed ? (
            <div
              role="dialog"
              aria-label={`Gambar soal ${question.id} (zoom)`}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
              onClick={() => setIsZoomed(false)}
            >
              <div
                className="relative max-w-[95%] max-h-[95%] overflow-auto"
                onClick={(e) => e.stopPropagation()}
                style={{ touchAction: "pan-y" }}
              >
                <div className="absolute right-2 top-2 z-50 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                    className="rounded bg-white/90 px-2 py-1 text-sm shadow"
                  >
                    −
                  </button>
                  <div className="rounded bg-white/90 px-3 py-1 text-sm text-slate-700 shadow">x{zoom.toFixed(2)}</div>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                    className="rounded bg-white/90 px-2 py-1 text-sm shadow"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label="Reset zoom"
                    onClick={() => setZoom(1)}
                    className="rounded bg-white/90 px-2 py-1 text-sm shadow"
                  >
                    ⟳
                  </button>
                </div>

                <img
                  src={imageUrl}
                  alt={`Gambar soal ${question.id}`}
                  style={{ width: `${zoom * 100}%`, height: "auto" }}
                  className={`rounded-md shadow-2xl ${zoom > 1 ? "cursor-grab" : "cursor-zoom-out"}`}
                  onDoubleClick={() => setZoom((z) => (z >= 2 ? 1 : 2))}
                  onMouseDown={(e) => {
                    if (zoom <= 1) return;
                    const el = e.currentTarget.parentElement as HTMLElement | null;
                    if (!el) return;
                    // capture a non-null reference for the closures below
                    const container: HTMLElement = el;
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startScrollLeft = container.scrollLeft;
                    const startScrollTop = container.scrollTop;
                    function onMove(ev: MouseEvent) {
                      container.scrollLeft = startScrollLeft - (ev.clientX - startX);
                      container.scrollTop = startScrollTop - (ev.clientY - startY);
                    }
                    function onUp() {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    }
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

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
                <span className="whitespace-pre-wrap break-words">{option}</span>
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
                <span className="whitespace-pre-wrap break-words">{option}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {question.questionType === "essay" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm select-text"
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
                  <p className="rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">{statement.text}</p>
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
            {['Benar', 'Salah'].map((option) => {
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
                  <span className="whitespace-pre-wrap">{option}</span>
                </label>
              );
            })}
          </div>
        )
      ) : null}

      {question.questionType === "matching" ? (
        <MatchingQuestion
          answerKeyPairs={normalizePairs(question.answerKey.pairs)}
          valuePairs={normalizePairs(value)}
          extraRightOptions={normalizeStringList((question.answerKey as { extraRightOptions?: unknown })?.extraRightOptions)}
          onChange={onChange}
          readOnly={readOnly}
        />
      ) : null}
    </fieldset>
  );
}
