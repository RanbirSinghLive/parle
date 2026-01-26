"use client";

import { useState } from "react";
import { GrammarEntry } from "@/lib/utils/progress";

interface GrammarCardProps {
  grammar: GrammarEntry[];
  maxVisible?: number;
}

function MasteryDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level
              ? "bg-primary-500"
              : "bg-slate-200 dark:bg-slate-600"
          }`}
        />
      ))}
    </div>
  );
}

export function GrammarCard({
  grammar,
  maxVisible = 4,
}: GrammarCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (grammar.length === 0) return null;

  // Sort by lowest mastery first, then by last practiced
  const sortedGrammar = [...grammar].sort((a, b) => {
    if (a.mastery_level !== b.mastery_level) {
      return a.mastery_level - b.mastery_level;
    }
    return new Date(b.last_practiced).getTime() - new Date(a.last_practiced).getTime();
  });

  const visibleGrammar = expanded
    ? sortedGrammar
    : sortedGrammar.slice(0, maxVisible);
  const hiddenCount = sortedGrammar.length - maxVisible;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>📝</span> Grammar Progress
      </h2>

      <div className="space-y-3">
        {visibleGrammar.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-white">
                {item.rule}
              </span>
              <MasteryDots level={item.mastery_level} />
            </div>
            {item.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            )}
            {item.common_errors.length > 0 && item.mastery_level <= 2 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Common errors: {item.common_errors.slice(0, 2).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more...`}
        </button>
      )}
    </div>
  );
}
