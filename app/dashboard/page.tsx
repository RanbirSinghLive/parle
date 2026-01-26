"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LessonPicker } from "@/components/LessonPicker";
import { TroubleWordsCard } from "@/components/TroubleWordsCard";
import { WeaknessesCard } from "@/components/WeaknessesCard";
import { GrammarCard } from "@/components/GrammarCard";
import { TopicsCard } from "@/components/TopicsCard";
import { RecommendedFocusCard } from "@/components/RecommendedFocusCard";
import {
  getTroubleWords,
  aggregateTopics,
  getRecommendedFocus,
  VocabularyEntry,
  GrammarEntry,
  TroubleWord,
  TopicSummary,
  SessionWithSummary,
} from "@/lib/utils/progress";

interface Profile {
  display_name: string | null;
  current_level: string;
  total_practice_minutes: number;
  streak_days: number;
  last_session_date: string | null;
  vocabulary: VocabularyEntry[];
  grammar: GrammarEntry[];
  weaknesses: string[];
  settings: {
    daily_goal_minutes: number;
  };
}

interface RecentSession {
  id: string;
  started_at: string;
  lesson_topic: string | null;
  summary: {
    durationMinutes: number;
    correctionsCount: number;
    recommendedFocus?: string[];
  } | null;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [allSessions, setAllSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [showLessonPicker, setShowLessonPicker] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Derived progress data
  const troubleWords = useMemo<TroubleWord[]>(
    () => getTroubleWords(profile?.vocabulary || []),
    [profile?.vocabulary]
  );

  const topicSummaries = useMemo<TopicSummary[]>(
    () => aggregateTopics(allSessions as SessionWithSummary[]),
    [allSessions]
  );

  const recommendedFocus = useMemo<string[]>(
    () => getRecommendedFocus(allSessions as SessionWithSummary[]),
    [allSessions]
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      // Fetch profile
      const profileResponse = await fetch("/api/profile");
      if (!profileResponse.ok) {
        if (profileResponse.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch profile");
      }
      const { profile } = await profileResponse.json();
      setProfile(profile);

      // Fetch recent sessions
      const sessionsResponse = await fetch("/api/sessions");
      if (sessionsResponse.ok) {
        const { sessions } = await sessionsResponse.json();
        setAllSessions(sessions);
        setRecentSessions(sessions.slice(0, 3));

        // Calculate today's practice time
        const today = new Date().toISOString().split("T")[0];
        const todaySessions = sessions.filter((s: RecentSession) =>
          s.started_at.startsWith(today)
        );
        const minutes = todaySessions.reduce(
          (acc: number, s: RecentSession) => acc + (s.summary?.durationMinutes || 0),
          0
        );
        setTodayMinutes(minutes);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const getDailyProgress = () => {
    if (!profile) return 0;
    return Math.min(100, (todayMinutes / profile.settings.daily_goal_minutes) * 100);
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
      <header className="bg-primary-800 text-white px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-primary-200 text-sm">{getGreeting()}</p>
              <h1 className="text-2xl font-bold">
                {profile?.display_name || "Learner"}
              </h1>
            </div>
            <button
              onClick={() => router.push("/settings")}
              className="p-2 rounded-full hover:bg-primary-700 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* Streak & Level */}
          <div className="flex gap-4">
            <div className="flex-1 bg-primary-700/50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🔥</span>
                <span className="text-2xl font-bold">{profile?.streak_days || 0}</span>
              </div>
              <p className="text-primary-200 text-sm">Day Streak</p>
            </div>
            <div className="flex-1 bg-primary-700/50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">📚</span>
                <span className="text-2xl font-bold">{profile?.current_level || "A1"}</span>
              </div>
              <p className="text-primary-200 text-sm">Current Level</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 -mt-4 pb-6 space-y-4">
        {/* Daily Goal Progress */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-900 dark:text-white">Today&apos;s Goal</h2>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {todayMinutes} / {profile?.settings.daily_goal_minutes || 15} min
            </span>
          </div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${getDailyProgress()}%` }}
            />
          </div>
          {getDailyProgress() >= 100 && (
            <p className="text-green-600 dark:text-green-400 text-sm mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Goal completed!
            </p>
          )}
        </div>

        {/* Start Session Button */}
        <button
          onClick={() => setShowLessonPicker(true)}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-600/30 transition flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          Start Conversation
        </button>

        {/* Lesson Picker Modal */}
        {showLessonPicker && (
          <LessonPicker
            onSelectFreeConversation={() => {
              setShowLessonPicker(false);
              router.push("/conversation");
            }}
            onSelectLesson={(topic) => {
              setShowLessonPicker(false);
              router.push(`/conversation?topic=${encodeURIComponent(topic)}`);
            }}
            onClose={() => setShowLessonPicker(false)}
          />
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {profile?.total_practice_minutes || 0}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Total Minutes</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {recentSessions.length > 0
                ? recentSessions.reduce((acc, s) => acc + (s.summary?.correctionsCount || 0), 0)
                : 0}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Recent Corrections</p>
          </div>
        </div>

        {/* Progress Section */}
        <TroubleWordsCard troubleWords={troubleWords} />
        <WeaknessesCard weaknesses={profile?.weaknesses || []} />
        <GrammarCard grammar={profile?.grammar || []} />
        <TopicsCard topics={topicSummaries} />
        <RecommendedFocusCard recommendations={recommendedFocus} />

        {/* Recent Sessions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent Sessions</h2>
            <button
              onClick={() => router.push("/history")}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              View All
            </button>
          </div>
          {recentSessions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              No sessions yet. Start practicing!
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {recentSessions.map((session) => (
                <div key={session.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {new Date(session.started_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {session.summary?.durationMinutes || 0} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      {session.summary?.correctionsCount || 0} corrections
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full py-3 text-slate-500 dark:text-slate-400 text-sm hover:text-slate-700 dark:hover:text-slate-300 transition"
        >
          Log Out
        </button>
      </main>
    </div>
  );
}
