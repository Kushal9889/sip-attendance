import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️ Missing Supabase env vars. Copy .env.example to .env and fill in your project URL and anon key.'
  );
}

// Using untyped client — explicit types are cast at usage sites in each page
// This avoids TypeScript "never" inference issues with the generic Database type
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
