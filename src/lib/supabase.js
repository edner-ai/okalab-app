import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://ftizayqhyyumrhwnaygo.supabase.co";
export const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0aXpheXFoeXl1bXJod25heWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMDk5MDYsImV4cCI6MjA4NDc4NTkwNn0.x8i688SRouVaZLyGdoB0j9JELe0IsI3rO2FGNeeomLg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
