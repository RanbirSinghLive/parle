"use client";

import { TopicSummary } from "@/lib/utils/progress";

interface TopicsCardProps {
  topics: TopicSummary[];
  maxVisible?: number;
}

export function TopicsCard({ topics, maxVisible = 5 }: TopicsCardProps) {
  if (topics.length === 0) return null;

  const visibleTopics = topics.slice(0, maxVisible);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>📚</span> Topics Practiced
      </h2>

      <div className="space-y-3">
        {visibleTopics.map((topic, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{topic.icon}</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {topic.topic}
              </span>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {topic.sessionCount} {topic.sessionCount === 1 ? "session" : "sessions"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
