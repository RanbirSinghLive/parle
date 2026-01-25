"use client";

import { SessionSummary as SessionSummaryType } from "@/lib/session";

interface SessionSummaryProps {
  summary: SessionSummaryType;
  onStartNewSession: () => void;
  onGoToDashboard: () => void;
}

export function SessionSummary({
  summary,
  onStartNewSession,
  onGoToDashboard,
}: SessionSummaryProps) {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 p-6 overflow-auto">
      <div className="max-w-md mx-auto w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Session Complete!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {summary.durationMinutes} minutes of practice
          </p>
        </div>

        {/* Highlights */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Highlights
          </h2>
          <p className="text-slate-700 dark:text-slate-300">{summary.highlights}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {summary.correctionsCount}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Corrections
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {summary.newVocabulary.length}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              New Words
            </div>
          </div>
        </div>

        {/* New Vocabulary */}
        {summary.newVocabulary.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              New Vocabulary
            </h2>
            <ul className="space-y-2">
              {summary.newVocabulary.map((vocab, index) => (
                <li
                  key={index}
                  className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {vocab.word}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 mx-2">
                      —
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {vocab.translation}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Grammar Practiced */}
        {summary.practicedGrammar.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Grammar Practiced
            </h2>
            <ul className="space-y-1">
              {summary.practicedGrammar.map((grammar, index) => (
                <li
                  key={index}
                  className="flex items-center text-slate-700 dark:text-slate-300"
                >
                  <span className="w-2 h-2 bg-primary-500 rounded-full mr-2" />
                  {grammar}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Focus */}
        {summary.recommendedFocus.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide mb-3">
              Focus Next Time
            </h2>
            <ul className="space-y-1">
              {summary.recommendedFocus.map((focus, index) => (
                <li
                  key={index}
                  className="flex items-center text-amber-700 dark:text-amber-300"
                >
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-2" />
                  {focus}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={onStartNewSession}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
          >
            Start New Session
          </button>
          <button
            onClick={onGoToDashboard}
            className="w-full py-3 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
