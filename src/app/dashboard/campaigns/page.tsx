'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Edit2, 
  Calendar as CalendarIcon,
  Send,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface SmsCampaign {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
  message_content: string;
}

function DeleteCampaignButton({ campaignId, onDelete }: { campaignId: string, onDelete: () => void }) {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('sms_campaigns').delete().eq('id', campaignId);
    if (error) {
      toast.error('Failed to delete campaign.', { description: error.message });
    } else {
      toast.success('Campaign deleted successfully!');
      onDelete();
    }
    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure? This will permanently delete this SMS campaign and all its message history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-600 hover:bg-red-700">
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const supabase = useSupabase();

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoadingCampaigns(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoadingCampaigns(false);
        return;
      }

      const { data, error } = await supabase
        .from('sms_campaigns')
        .select('id, name, status, scheduled_at, message_content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        toast.error('Error loading campaigns.', { description: error.message });
      } else {
        setCampaigns(data || []);
      }
      setLoadingCampaigns(false);
    };
    fetchCampaigns();
  }, [supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-400/10 text-green-400 border border-green-400/20"><CheckCircle2 className="w-3 h-3" /> <span>Completed</span></span>;
      case 'sending':
        return <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 shadow-[0_0_10px_rgba(66,245,230,0.1)]"><Send className="w-3 h-3 animate-pulse" /> <span>Sending</span></span>;
      case 'scheduled':
        return <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20"><Clock className="w-3 h-3" /> <span>Scheduled</span></span>;
      default:
        return <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-text-muted border border-white/10">{status}</span>;
    }
  };

  if (loadingCampaigns) {
    return (
      <div className="p-20 text-center text-text-muted animate-pulse">Loading your campaigns...</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white text-glow">SMS Campaigns</h1>
          <p className="text-text-muted text-sm mt-1">Track and manage your broadcast history.</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(66,245,230,0.3)]" asChild>
          <Link href="/dashboard/campaigns/create">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Link>
        </Button>
      </div>

      <div className="glass-card border-white/5 bg-white/2 overflow-hidden">
        {campaigns && campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled At</TableHead>
                  <TableHead>Message Preview</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} className="group">
                    <TableCell>
                      <span className="font-semibold text-white group-hover:text-accent transition-colors">{campaign.name}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-text-muted text-sm whitespace-nowrap">
                      <div className="flex items-center space-x-2 group-hover:text-white transition-colors">
                        <CalendarIcon className="w-3.5 h-3.5 text-accent/50" />
                        <span>
                          {campaign.scheduled_at
                            ? new Date(campaign.scheduled_at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Immediately'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-text-muted text-xs italic group-hover:text-white/70 transition-colors">
                      &quot;{campaign.message_content}&quot;
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center space-x-1">
                        <Button variant="ghost" size="icon" className="text-text-muted hover:text-accent hover:bg-accent/10" asChild>
                          <Link href={`/dashboard/campaigns/${campaign.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        </Button>
                        <DeleteCampaignButton 
                          campaignId={campaign.id} 
                          onDelete={() => {
                            setCampaigns(prev => prev.filter(c => c.id !== campaign.id));
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/10 shadow-[0_0_30px_rgba(66,245,230,0.05)]">
              <MessageSquare className="w-10 h-10 text-accent/40" />
            </div>
            <h3 className="text-xl font-bold text-white">No campaigns found</h3>
            <p className="text-text-muted max-w-xs mx-auto mt-2 text-sm">
              Set up your first automated SMS blast to reach your contacts.
            </p>
            <Button className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(66,245,230,0.3)] px-8" asChild>
              <Link href="/dashboard/campaigns/create">Create your first campaign</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
