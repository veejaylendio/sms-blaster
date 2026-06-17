import { createClient } from '@/lib/supabase/server';
import { 
  Users, 
  Send, 
  Clock, 
  AlertCircle, 
  Smartphone,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch dashboard stats
  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: totalSmsSent } = await supabase
    .from('sms_messages')
    .select('*, contacts!inner(*)', { count: 'exact', head: true })
    .eq('status', 'sent')
    .eq('contacts.user_id', user.id);

  const { count: scheduledSms } = await supabase
    .from('sms_messages')
    .select('*, contacts!inner(*)', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('contacts.user_id', user.id);

  const { count: failedSms } = await supabase
    .from('sms_messages')
    .select('*, contacts!inner(*)', { count: 'exact', head: true })
    .eq('status', 'failed')
    .eq('contacts.user_id', user.id);

  const { count: onlineDevices } = await supabase
    .from('android_devices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'online');

  // Fetch recent campaigns
  const { data: recentCampaigns } = await supabase
    .from('sms_campaigns')
    .select('id, name, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const stats = [
    { label: 'Total Contacts', value: totalContacts || 0, icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Total SMS Sent', value: totalSmsSent || 0, icon: Send, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Scheduled', value: scheduledSms || 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Failed Messages', value: failedSms || 0, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
    { label: 'Devices Online', value: onlineDevices || 0, icon: Smartphone, color: 'text-accent', bg: 'bg-accent/10' },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-6 border-white/5 bg-white/2 hover:border-accent/30 group">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{stat.label}</span>
              <div className={`${stat.bg} ${stat.color} p-2 rounded-lg border border-current/20 shadow-[0_0_10px_rgba(var(--accent-glow),0.1)]`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white group-hover:text-glow transition-all">{stat.value}</p>
              <div className="text-[10px] text-green-400 flex items-center gap-1 font-medium">
                <ChevronRight className="w-3 h-3 rotate-[-90deg]" />
                +12%
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card border-white/5 bg-white/2 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Operations</h2>
              <p className="text-xs text-text-muted">Latest SMS campaign activities</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-accent hover:text-accent hover:bg-accent/10">
              <Link href="/dashboard/campaigns">View all</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">Campaign Name</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">Performance</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {recentCampaigns && recentCampaigns.length > 0 ? (
                  recentCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white group-hover:text-accent transition-colors">{campaign.name}</p>
                        <p className="text-[10px] text-text-muted">
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          campaign.status === 'completed' ? 'bg-green-400/10 text-green-400 border-green-400/20' :
                          campaign.status === 'sending' ? 'bg-accent/10 text-accent border-accent/20' :
                          campaign.status === 'scheduled' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                          'bg-white/10 text-text-muted border-white/10'
                        }`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-grow h-1.5 bg-white/10 rounded-full overflow-hidden w-24">
                            <div 
                              className="h-full bg-accent shadow-[0_0_10px_rgba(66,245,230,0.5)]" 
                              style={{ width: campaign.status === 'completed' ? '100%' : '45%' }}
                            />
                          </div>
                          <span className="text-[10px] text-accent font-medium">{campaign.status === 'completed' ? 'Optimal' : 'Active'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-accent transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <p className="text-text-muted text-sm">No recent campaigns yet.</p>
                      <Button variant="outline" className="mt-4 border-accent/30 text-accent hover:bg-accent/10" asChild>
                        <Link href="/dashboard/campaigns/create">Create your first campaign</Link>
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card border-accent/20 bg-accent/5 p-8 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 blur-3xl -mr-16 -mt-16 group-hover:bg-accent/20 transition-all duration-500"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center border border-accent/30 mb-6 shadow-[0_0_20px_rgba(66,245,230,0.2)]">
              <Send className="w-6 h-6 text-accent text-glow" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Ready to blast?</h3>
            <p className="text-text-muted text-sm leading-relaxed mb-8">
              Reach all your contacts instantly with a new SMS campaign. All system core protocols are operational.
            </p>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_rgba(66,245,230,0.4)] h-12 text-base font-bold" asChild>
              <Link href="/dashboard/campaigns/create">START CAMPAIGN</Link>
            </Button>
          </div>
          <div className="mt-10 pt-8 border-t border-white/5 relative z-10">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold block mb-1">Active Security Node</span>
                <span className="text-lg font-bold text-white">04 Mins Ago</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold block mb-1">Active Devices</span>
                <span className="text-3xl font-black text-white text-glow">{onlineDevices || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
