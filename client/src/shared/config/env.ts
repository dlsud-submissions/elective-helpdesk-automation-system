/**
 * Public browser configuration. Only VITE_* values that are safe to ship in
 * the bundle belong here: never a service-role key or Gemini key.
 */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(
    /\/$/,
    ''
  ),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};
