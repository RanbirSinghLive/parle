"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface UserSettings {
  correction_style: "during_pauses" | "after_message" | "never";
  default_mode: "free_conversation" | "structured_lesson";
  tts_speed: number;
  target_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  daily_goal_minutes: number;
}

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  current_level: string;
  settings: UserSettings;
  total_practice_minutes: number;
  streak_days: number;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Mastery",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch profile");
      }
      const { profile } = await response.json();
      setProfile(profile);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const newSettings = { ...profile.settings, ...updates };
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      const { profile: updatedProfile } = await response.json();
      setProfile(updatedProfile);
      setMessage({ type: "success", text: "Settings saved!" });

      // Clear success message after 2 seconds
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error("Failed to update settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const updateLevel = async (level: string) => {
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_level: level,
          settings: { ...profile.settings, target_level: level },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save level");
      }

      const { profile: updatedProfile } = await response.json();
      setProfile(updatedProfile);
      setMessage({ type: "success", text: "Level updated!" });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error("Failed to update level:", error);
      setMessage({ type: "error", text: "Failed to save level" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-400">Failed to load settings</p>
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
          <h1 className="text-xl font-semibold">Settings</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* Status Message */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile Section */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Profile
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Email</label>
              <p className="text-slate-900 dark:text-white">{profile.email}</p>
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Total Practice</label>
              <p className="text-slate-900 dark:text-white">
                {profile.total_practice_minutes} minutes ({profile.streak_days} day streak)
              </p>
            </div>
          </div>
        </section>

        {/* Current Level */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            French Level
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => updateLevel(level)}
                disabled={saving}
                className={`p-3 rounded-lg text-center transition ${
                  profile.current_level === level
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                } disabled:opacity-50`}
              >
                <div className="font-semibold">{level}</div>
                <div className="text-xs opacity-80">{LEVEL_DESCRIPTIONS[level]}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Correction Style */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Correction Style
          </h2>
          <div className="space-y-2">
            {[
              { value: "during_pauses", label: "During conversation", desc: "Get corrections naturally during pauses" },
              { value: "after_message", label: "After each message", desc: "Corrections immediately after you speak" },
              { value: "never", label: "Never", desc: "No corrections, just practice" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => updateSettings({ correction_style: option.value as UserSettings["correction_style"] })}
                disabled={saving}
                className={`w-full p-3 rounded-lg text-left transition ${
                  profile.settings.correction_style === option.value
                    ? "bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500"
                    : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
                } disabled:opacity-50`}
              >
                <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{option.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* TTS Speed */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Speech Speed
          </h2>
          <div className="space-y-3">
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={profile.settings.tts_speed}
              onChange={(e) => updateSettings({ tts_speed: parseFloat(e.target.value) })}
              disabled={saving}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>Slower</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {profile.settings.tts_speed.toFixed(1)}x
              </span>
              <span>Faster</span>
            </div>
          </div>
        </section>

        {/* Daily Goal */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Daily Goal
          </h2>
          <div className="flex gap-2">
            {[5, 10, 15, 20, 30].map((minutes) => (
              <button
                key={minutes}
                onClick={() => updateSettings({ daily_goal_minutes: minutes })}
                disabled={saving}
                className={`flex-1 py-2 px-3 rounded-lg text-center transition ${
                  profile.settings.daily_goal_minutes === minutes
                    ? "bg-primary-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                } disabled:opacity-50`}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </section>

        {/* Logout */}
        <section className="pt-4">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition"
          >
            Log Out
          </button>
        </section>
      </main>
    </div>
  );
}
