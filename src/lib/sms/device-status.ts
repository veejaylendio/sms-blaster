import { SupabaseClient } from '@supabase/supabase-js';
import net from 'net';

function checkTcpConnectivity(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; socket.destroy(); resolve(false); }
    }, timeoutMs);

    socket.on('connect', () => {
      if (!settled) { settled = true; clearTimeout(timer); socket.destroy(); resolve(true); }
    });

    socket.on('error', () => {
      if (!settled) { settled = true; clearTimeout(timer); socket.destroy(); resolve(false); }
    });
  });
}

function parseUrl(url: string): { host: string; port: number } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: parseInt(u.port) || 80 };
  } catch {
    return null;
  }
}

export async function checkAndUpdateDeviceStatuses(supabase: SupabaseClient, userId: string) {
  // Fetch devices from DB
  const { data: devices, error } = await supabase
    .from('android_devices')
    .select('id, device_name, device_id, last_seen_at, status, device_type, gateway_url')
    .eq('user_id', userId);

  if (error || !devices) {
    console.error('Error fetching devices to check status:', error);
    return [];
  }

  const now = new Date();
  const checkPromises = devices.map(async (device) => {
    let newStatus = device.status;
    let newLastSeen = device.last_seen_at;

    if (device.device_type === 'mymobkit') {
      const gatewayUrl = device.gateway_url || process.env.ANDROID_SMS_API_URL;
      if (!gatewayUrl) {
        newStatus = 'offline';
      } else {
        const cleanGatewayUrl = gatewayUrl.replace(/\/$/, '');
        const parsed = parseUrl(cleanGatewayUrl);
        if (!parsed) {
          newStatus = 'offline';
        } else {
          const startTime = Date.now();
          const reachable = await checkTcpConnectivity(parsed.host, parsed.port, 5000);
          const elapsed = Date.now() - startTime;

          if (reachable) {
            newStatus = 'online';
            newLastSeen = now.toISOString();
            console.log(`[health] ${cleanGatewayUrl} -> reachable (${elapsed}ms) -> ${newStatus}`);
          } else {
            newStatus = 'offline';
            console.log(`[health] ${cleanGatewayUrl} -> unreachable (${elapsed}ms) -> ${newStatus}`);
          }
        }
      }
    } else {
      // Native device: pull-based. Check last_seen_at
      if (!device.last_seen_at) {
        newStatus = 'pending'; // Never connected
      } else {
        const lastSeenDate = new Date(device.last_seen_at);
        const diffMs = now.getTime() - lastSeenDate.getTime();
        const twoMinutesMs = 2 * 60 * 1000;
        
        if (diffMs < twoMinutesMs) {
          newStatus = 'online';
        } else {
          newStatus = 'offline';
        }
      }
    }

    // If status has changed or last_seen_at has changed for mymobkit, update DB
    if (newStatus !== device.status || newLastSeen !== device.last_seen_at) {
      const { error: updateError } = await supabase
        .from('android_devices')
        .update({
          status: newStatus,
          last_seen_at: newLastSeen,
        })
        .eq('id', device.id);

      if (updateError) {
        console.error(`Failed to update status for device ${device.id}:`, updateError);
      } else {
        device.status = newStatus;
        device.last_seen_at = newLastSeen;
      }
    }
    
    return device;
  });

  return Promise.all(checkPromises);
}
