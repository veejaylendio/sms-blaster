'use client';

import { useSupabase } from '@/components/supabase-provider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  UsersRound,
  MessageSquare, 
  Smartphone, 
  LogOut,
  Menu,
  Search
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
    };
    getUser();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
    { label: 'Contact Groups', href: '/dashboard/contact-groups', icon: UsersRound },
    { label: 'Bulk SMS', href: '/dashboard/bulk-sms', icon: MessageSquare },
    { label: 'Devices', href: '/dashboard/devices', icon: Smartphone },
  ];

  if (!user) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-transparent relative overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[260px] flex-col bg-black/10 backdrop-blur-xl border-r border-white/10 sticky top-0 h-screen z-20">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-[0_0_15px_rgba(66,245,230,0.1)]">
              <LayoutDashboard className="w-6 h-6 text-accent text-glow" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              NEXUS<span className="text-accent">CORE</span>
            </h1>
          </div>
        </div>
        
        <nav className="flex-grow px-4 mt-8 space-y-2">
          {navItems.map((item) => {
            const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? 'text-white bg-white/5 border-l-2 border-accent shadow-inner' 
                    : 'text-text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-accent' : 'group-hover:text-accent'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full border-2 border-accent shadow-[0_0_10px_rgba(66,245,230,0.3)] bg-accent/10 flex items-center justify-center font-bold text-accent">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-grow overflow-hidden">
              <h4 className="text-sm font-medium text-white truncate">{user.email?.split('@')[0]}</h4>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">User Admin</span>
            </div>
          </div>
          <Button 
            onClick={handleLogout}
            variant="ghost" 
            className="w-full justify-start text-text-muted hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-black/20 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold text-white tracking-tight">NEXUSCORE</h1>
        </div>
        <Button variant="ghost" size="icon" className="text-white">
          <Menu className="w-6 h-6" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-w-0 z-10">
        <header className="hidden md:flex h-20 items-center justify-between px-10 bg-transparent sticky top-0 z-40">
          <div>
            <h1 className="text-2xl font-medium text-white">System Overview</h1>
            <p className="text-xs text-text-muted">Welcome back, here is your performance current status.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search parameters..." 
                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
          </div>
        </header>
        
        <div className="p-6 md:p-10 md:pt-4">
          {children}
        </div>
      </main>
    </div>
  );
}
