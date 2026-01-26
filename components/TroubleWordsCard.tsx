"use client";

import { useState } from "react";
import { TroubleWord } from "@/lib/utils/progress";

interface TroubleWordsCardProps {
  troubleWords: TroubleWord[];
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
              ? "bg-amber-500"
              : "bg-amber-200 dark:bg-amber-800"
          }`}
        />
      ))}
    </div>
  );
}

export function TroubleWordsCard({
  troubleWords,
  maxVisible = 3,
}: TroubleWordsCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (troubleWords.length === 0) return null;

  const visibleWords = expanded
    ? troubleWords
    : troubleWords.slice(0, maxVisible);
  const hiddenCount = troubleWords.length - maxVisible;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-sm border border-amber-200 dark:border-amber-800">
      <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>⚠️</span> Words to Review
      </h2>

      <div className="space-y-2">
        {visibleWords.map((word, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-1"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium text-amber-900 dark:text-amber-100">
                {word.word}
              </span>
              <span className="text-amber-600 dark:text-amber-400 mx-2">
                →
              </span>
              <span className="text-amber-700 dark:text-amber-300">
                {word.translation}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm ml-2 shrink-0">
              <span className="text-amber-600 dark:text-amber-400 text-xs">
                {word.timesCorrect}/{word.timesSeen}
              </span>
              <MasteryDots level={word.masteryLevel} />
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-amber-600 dark:text-amber-400 hover:underline"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more...`}
        </button>
      )}
    </div>
  );
}
