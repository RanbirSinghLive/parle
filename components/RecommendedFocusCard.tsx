"use client";

interface RecommendedFocusCardProps {
  recommendations: string[];
}

export function RecommendedFocusCard({
  recommendations,
}: RecommendedFocusCardProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 shadow-sm border border-primary-200 dark:border-primary-800">
      <h2 className="text-sm font-semibold text-primary-800 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>💡</span> Recommended Focus
      </h2>

      <ul className="space-y-2">
        {recommendations.map((rec, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-primary-700 dark:text-primary-300"
          >
            <span className="text-primary-500 mt-0.5">→</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
