'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useSupabase(); // Use the hook

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard'); // Redirect to dashboard on successful login
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center border border-white/10 overflow-hidden mb-4 shadow-[0_0_20px_rgba(168,150,255,0.15)]">
          <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-glow mb-1">New Life Iligan</h1>
        <h2 className="text-lg font-medium text-accent mb-2">SMS Blaster</h2>
        <p className="text-text-muted text-sm">Sign in to your account</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="bg-white/5 border-white/10 focus:border-accent/50"
          />
        </div>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="bg-white/5 border-white/10 focus:border-accent/50"
          />
        </div>
        {error && <p className="text-destructive text-sm text-center font-medium">{error}</p>}
        <Button 
          type="submit" 
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(168,150,255,0.3)]" 
          disabled={loading}
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </Button>
      </form>
      <div className="text-center pt-2">
        <p className="text-sm text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-accent hover:text-accent/80 font-medium transition-colors">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
