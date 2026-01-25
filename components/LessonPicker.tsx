"use client";

interface LessonPickerProps {
  onSelectFreeConversation: () => void;
  onSelectLesson: (topic: string) => void;
  onClose: () => void;
}

const LESSON_TOPICS = [
  {
    category: "Basics",
    topics: [
      { id: "greetings", name: "Greetings & Introductions", icon: "👋" },
      { id: "numbers", name: "Numbers & Time", icon: "🔢" },
      { id: "weather", name: "Weather & Seasons", icon: "☀️" },
    ],
  },
  {
    category: "Daily Life",
    topics: [
      { id: "restaurant", name: "At the Restaurant", icon: "🍽️" },
      { id: "shopping", name: "Shopping & Prices", icon: "🛍️" },
      { id: "directions", name: "Asking for Directions", icon: "🗺️" },
    ],
  },
  {
    category: "Grammar Focus",
    topics: [
      { id: "passe-compose", name: "Passé Composé", icon: "📝" },
      { id: "imparfait", name: "Imparfait", icon: "📖" },
      { id: "subjunctive", name: "Subjunctive Mood", icon: "🎯" },
    ],
  },
  {
    category: "Conversation",
    topics: [
      { id: "hobbies", name: "Hobbies & Interests", icon: "🎨" },
      { id: "travel", name: "Travel & Vacation", icon: "✈️" },
      { id: "work", name: "Work & Career", icon: "💼" },
    ],
  },
];

export function LessonPicker({
  onSelectFreeConversation,
  onSelectLesson,
  onClose,
}: LessonPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Choose Your Practice
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"
          >
            <svg
              className="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Free Conversation */}
          <button
            onClick={onSelectFreeConversation}
            className="w-full p-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl text-left hover:from-primary-600 hover:to-primary-700 transition shadow-lg shadow-primary-500/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">💬</span>
              <div>
                <h3 className="font-semibold text-lg">Free Conversation</h3>
                <p className="text-primary-100 text-sm">
                  Chat about anything - your tutor follows your lead
                </p>
              </div>
            </div>
          </button>

          {/* Lesson Topics */}
          {LESSON_TOPICS.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                {category.category}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {category.topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => onSelectLesson(topic.name)}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition text-left"
                  >
                    <span className="text-2xl">{topic.icon}</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {topic.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
