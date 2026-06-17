'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useSupabase(); // Use the hook

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      alert('Check your email for a magic link to log in!');
      router.push('/login'); // Redirect to login page after sign-up
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-glow mb-2">Join NexusCore</h1>
        <p className="text-text-muted text-sm">Create your account to get started</p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
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
            placeholder="Create password"
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
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(66,245,230,0.3)]" 
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </Button>
      </form>
      <div className="text-center pt-2">
        <p className="text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:text-accent/80 font-medium transition-colors">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
