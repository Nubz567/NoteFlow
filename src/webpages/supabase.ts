import { createClient } from "@supabase/supabase-js";

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigError = getSupabaseConfigError(supabaseUrl, supabaseAnonKey);
export const hasSupabaseConfig = !supabaseConfigError;

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

function normalizeSupabaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return "";
  }

  const urlWithProtocol =
    trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")
      ? trimmedValue
      : `https://${trimmedValue}`;

  try {
    return new URL(urlWithProtocol).origin;
  } catch {
    return urlWithProtocol.replace(/\/$/, "");
  }
}

function getSupabaseConfigError(supabaseUrl: string, supabaseAnonKey: string | undefined) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return "Supabase is not configured yet. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values in .env.";
  }

  try {
    const url = new URL(supabaseUrl);

    if (!url.hostname.endsWith(".supabase.co")) {
      return "Your VITE_SUPABASE_URL should look like https://your-project-id.supabase.co.";
    }
  } catch {
    return "Your VITE_SUPABASE_URL is not a valid URL.";
  }

  if (!supabaseAnonKey.startsWith("sb_publishable_") && !supabaseAnonKey.startsWith("eyJ")) {
    return "Your VITE_SUPABASE_ANON_KEY should be the Supabase publishable key.";
  }

  return "";
}
