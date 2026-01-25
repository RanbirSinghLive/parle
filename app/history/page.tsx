"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SessionSummary {
  durationMinutes: number;
  newVocabulary: Array<{ word: string; translation: string }>;
  practicedGrammar: string[];
  correctionsCount: number;
  highlights: string;
}

interface SessionItem {
  id: string;
  started_at: string;
  ended_at: string;
  mode: string;
  lesson_topic: string | null;
  summary: SessionSummary | null;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/sessions");
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch sessions");
      }
      const { sessions } = await response.json();
      setSessions(sessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    return minutes;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 bg-primary-800 text-white px-4 py-3 shadow-md z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => router.push("/conversation")}
            className="text-sm text-primary-200 hover:text-white transition"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold">History</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No sessions yet
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Start a conversation to see your history here
            </p>
            <button
              onClick={() => router.push("/conversation")}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Start Practicing
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedId === session.id;
              const duration = session.summary?.durationMinutes || calculateDuration(session.started_at, session.ended_at);

              return (
                <div
                  key={session.id}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  {/* Session Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {formatDate(session.started_at)}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {formatTime(session.started_at)} · {duration} min
                        {session.lesson_topic && ` · ${session.lesson_topic}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {session.summary && (
                        <div className="text-right">
                          <div className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            {session.summary.correctionsCount} corrections
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {session.summary.newVocabulary?.length || 0} new words
                          </div>
                        </div>
                      )}
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && session.summary && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                      <div className="pt-4 space-y-4">
                        {/* Highlights */}
                        <div>
                          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                            Highlights
                          </h3>
                          <p className="text-slate-700 dark:text-slate-300 text-sm">
                            {session.summary.highlights}
                          </p>
                        </div>

                        {/* New Vocabulary */}
                        {session.summary.newVocabulary?.length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              New Vocabulary
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {session.summary.newVocabulary.map((vocab, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-sm"
                                >
                                  {vocab.word}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Grammar */}
                        {session.summary.practicedGrammar?.length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              Grammar Practiced
                            </h3>
                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                              {session.summary.practicedGrammar.map((grammar, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                  {grammar}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
