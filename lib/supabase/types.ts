export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          current_level: string;
          vocabulary: Json;
          grammar: Json;
          topics: Json;
          strengths: string[];
          weaknesses: string[];
          total_practice_minutes: number;
          streak_days: number;
          last_session_date: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          current_level?: string;
          vocabulary?: Json;
          grammar?: Json;
          topics?: Json;
          strengths?: string[];
          weaknesses?: string[];
          total_practice_minutes?: number;
          streak_days?: number;
          last_session_date?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          current_level?: string;
          vocabulary?: Json;
          grammar?: Json;
          topics?: Json;
          strengths?: string[];
          weaknesses?: string[];
          total_practice_minutes?: number;
          streak_days?: number;
          last_session_date?: string | null;
          settings?: Json;
          updated_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          mode: string;
          lesson_topic: string | null;
          transcript: Json;
          corrections: Json;
          summary: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at?: string;
          ended_at?: string | null;
          mode?: string;
          lesson_topic?: string | null;
          transcript?: Json;
          corrections?: Json;
          summary?: Json | null;
          created_at?: string;
        };
        Update: {
          ended_at?: string | null;
          mode?: string;
          lesson_topic?: string | null;
          transcript?: Json;
          corrections?: Json;
          summary?: Json | null;
        };
      };
    };
  };
}

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
