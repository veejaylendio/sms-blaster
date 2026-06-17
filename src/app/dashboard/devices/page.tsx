'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase
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

import { Smartphone } from 'lucide-react';

interface AndroidDevice {
  id: string;
  device_name: string;
  device_id: string;
  last_seen_at: string | null;
  status: string;
  device_type: string;
  gateway_url: string | null;
}

function DeleteDeviceButton({ deviceId }: { deviceId: string }) {
  const supabase = useSupabase(); // Use the hook
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('android_devices').delete().eq('id', deviceId);
    if (error) {
      toast.error('Failed to delete device.', { description: error.message });
    } else {
      toast.success('Device deleted successfully!');
      router.refresh(); // Re-fetch devices after deletion
    }
    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={loading}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently unregister this Android device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const supabase = useSupabase(); // Use the hook

  useEffect(() => {
    const fetchDevices = async () => {
      setLoadingDevices(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoadingDevices(false);
        return;
      }

      const { data, error } = await supabase
        .from('android_devices')
        .select('id, device_name, device_id, last_seen_at, status, device_type, gateway_url')
        .eq('user_id', user.id)
        .order('device_name', { ascending: true });

      if (error) {
        console.error('Error fetching devices:', error);
        toast.error('Error loading devices.', { description: error.message });
      } else {
        setDevices(data || []);
      }
      setLoadingDevices(false);
    };
    fetchDevices();
  }, [supabase]);

  if (loadingDevices) {
    return (
      <div className="p-20 text-center text-text-muted animate-pulse">Loading your devices...</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white text-glow">Android Gateways</h1>
          <p className="text-text-muted text-sm mt-1">Manage your connected sending devices.</p>
        </div>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(66,245,230,0.3)]" asChild>
          <Link href="/dashboard/devices/register">Register New Device</Link>
        </Button>
      </div>

      <div className="glass-card border-white/5 bg-white/2 overflow-hidden">
        {devices && devices.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gateway Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Endpoint / ID</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id} className="group">
                    <TableCell>
                      <span className="font-semibold text-white group-hover:text-accent transition-colors">{device.device_name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-text-muted border border-white/10">
                        {device.device_type === 'mymobkit' ? 'Mymobkit' : 'Native App'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-text-muted group-hover:text-white/70 transition-colors">
                      {device.device_type === 'mymobkit' ? device.gateway_url : device.device_id}
                    </TableCell>
                    <TableCell className="text-text-muted text-sm whitespace-nowrap group-hover:text-white/70 transition-colors">
                      {device.last_seen_at
                        ? new Date(device.last_seen_at).toLocaleString()
                        : device.device_type === 'mymobkit' ? 'N/A' : 'Never'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        device.status === 'online' ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-white/5 text-text-muted border-white/10'
                      }`}>
                        {device.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteDeviceButton deviceId={device.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/10 shadow-[0_0_30px_rgba(66,245,230,0.05)]">
              <Smartphone className="w-10 h-10 text-accent/40" />
            </div>
            <h3 className="text-xl font-bold text-white">No devices registered</h3>
            <p className="text-text-muted max-w-xs mx-auto mt-2 text-sm">
              Register your first device to start sending automated SMS blasts.
            </p>
            <Button className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(66,245,230,0.3)] px-8" asChild>
              <Link href="/dashboard/devices/register">Register Device</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
