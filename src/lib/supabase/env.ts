const SUPABASE_URL_REGEX = /^https:\/\/[a-z0-9-]+\.(supabase\.co|supabase\.in)$/;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or your hosting environment.'
    );
  }

  if (!SUPABASE_URL_REGEX.test(url)) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_URL. It must look like https://<project-ref>.supabase.co'
    );
  }

  return { url, anonKey };
}
