import React, { useEffect, useRef, useState } from "react";

type Pair = { left: string; right: string };

export default function MatchingQuestion({
  answerKeyPairs,
  valuePairs,
  onChange,
  readOnly = false,
  extraRightOptions = [],
}: {
  answerKeyPairs: Pair[];
  valuePairs: Pair[];
  onChange?: (next: Pair[]) => void;
  readOnly?: boolean;
  extraRightOptions?: string[];
}) {
  const leftItems = Array.from(new Set(answerKeyPairs.map((p) => p.left)));
  const initialRight = Array.from(
    new Set([
      ...answerKeyPairs.map((p) => p.right),
      ...extraRightOptions,
      ...valuePairs.map((p) => p.right),
    ])
  );

  const [rightItems, setRightItems] = useState<string[]>(initialRight);
  useEffect(() => setRightItems(initialRight), [answerKeyPairs, extraRightOptions.join("|")]);

  const [pairs, setPairs] = useState<Pair[]>(valuePairs ?? []);
  useEffect(() => setPairs(valuePairs ?? []), [valuePairs]);

  const leftRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rightRefs = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number; color: string }>>([]);

  const colors = ["#7c3aed", "#ef4444", "#f97316", "#10b981", "#06b6d4", "#8b5cf6"];

  function updatePairs(next: Pair[]) {
    setPairs(next);
    onChange?.(next);
  }

  function pairLeftToRight(left: string, right: string) {
    if (readOnly) return;
    // remove any previous mapping for left or right to keep one-to-one
    const filtered = pairs.filter((p) => p.left !== left && p.right !== right);
    updatePairs([...filtered, { left, right }]);
  }

  function removePairForLeft(left: string) {
    if (readOnly) return;
    updatePairs(pairs.filter((p) => p.left !== left));
  }

  function removeRightOption(right: string) {
    if (readOnly) return;
    setRightItems((r) => r.filter((x) => x !== right));
    // also remove any pairs using it
    updatePairs(pairs.filter((p) => p.right !== right));
  }

  function addRightOption(value: string) {
    if (!value) return;
    setRightItems((r) => (r.includes(value) ? r : [...r, value]));
  }

  useEffect(() => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return setLines([]);

    const newLines: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
    pairs.forEach((p, i) => {
      const li = leftItems.indexOf(p.left);
      const ri = rightItems.indexOf(p.right);
      const leftEl = leftRefs.current[li];
      const rightEl = rightRefs.current[ri];
      if (!leftEl || !rightEl) return;
      const l = leftEl.getBoundingClientRect();
      const r = rightEl.getBoundingClientRect();
      newLines.push({
        x1: l.right - containerRect.left,
        y1: l.top + l.height / 2 - containerRect.top,
        x2: r.left - containerRect.left,
        y2: r.top + r.height / 2 - containerRect.top,
        color: colors[i % colors.length],
      });
    });
    setLines(newLines);
  }, [pairs, leftItems.join("|"), rightItems.join("|")]);

  // small inputs state for add controls
  const [newRight, setNewRight] = useState("");

  return (
    <div ref={containerRef} className="relative">
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Left</div>
          </div>

          <div className="space-y-3">
            {leftItems.map((left, i) => {
              const paired = pairs.find((p) => p.left === left);
              const color = paired ? colors[pairs.findIndex((x) => x.left === left) % colors.length] : undefined;
              return (
                <div
                  key={left}
                  ref={(el) => { leftRefs.current[i] = el }}
                  onClick={() => {
                    if (paired) {
                      removePairForLeft(left);
                    }
                  }}
                  className={`rounded-md border px-3 py-2 text-sm cursor-pointer ${paired ? "shadow-inner" : ""}`}
                  style={paired ? { background: color, color: "white" } : {}}
                >
                  {left}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Right</div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <input
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="Add option"
                  value={newRight}
                  onChange={(e) => setNewRight(e.target.value)}
                />
                <button
                  type="button"
                  className="bg-slate-700 text-white px-2 py-1 rounded text-sm"
                  onClick={() => {
                    addRightOption(newRight.trim());
                    setNewRight("");
                  }}
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {rightItems.map((right, i) => {
              const paired = pairs.find((p) => p.right === right);
              const color = paired ? colors[pairs.findIndex((x) => x.right === right) % colors.length] : undefined;
              return (
                <div key={right} className="flex items-center gap-2">
                  <div
                    ref={(el) => { rightRefs.current[i] = el }}
                    onClick={() => {
                      // when clicking right, pair with first unpaired left if any
                      if (readOnly) return;
                      const unpairedLeft = leftItems.find((l) => !pairs.find((p) => p.left === l));
                      if (unpairedLeft) pairLeftToRight(unpairedLeft, right);
                    }}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm cursor-pointer ${paired ? "shadow-inner" : ""}`}
                    style={paired ? { background: color, color: "white" } : {}}
                  >
                    {right}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className="text-red-500 text-sm"
                      onClick={() => removeRightOption(right)}
                      aria-label={`Remove ${right}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
        {lines.map((ln, i) => (
          <line
            key={i}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={ln.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
