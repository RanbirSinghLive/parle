"use client";

interface WeaknessesCardProps {
  weaknesses: string[];
}

export function WeaknessesCard({ weaknesses }: WeaknessesCardProps) {
  if (weaknesses.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>🎯</span> Areas to Improve
      </h2>

      <ul className="space-y-2">
        {weaknesses.map((weakness, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-slate-700 dark:text-slate-300"
          >
            <span className="text-amber-500 mt-0.5">•</span>
            <span>{weakness}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
