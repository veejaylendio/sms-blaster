import { SupabaseClient } from '@supabase/supabase-js';

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
      if (!device.gateway_url) {
        newStatus = 'offline';
      } else {
        try {
          // Attempt to ping the mymobkit gateway URL
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
          
          // Clean the gateway URL (remove trailing slash)
          const gatewayUrl = device.gateway_url.replace(/\/$/, '');
          
          // Fetch mymobkit gateway. If we get any response, it means it is online.
          const response = await fetch(gatewayUrl, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-store',
          });
          
          clearTimeout(timeoutId);
          
          // If response is successful or we at least connected (status < 500)
          if (response.ok || response.status < 500) {
            newStatus = 'online';
            newLastSeen = now.toISOString();
          } else {
            newStatus = 'offline';
          }
        } catch {
          // If fetch fails (timeout, connection refused, etc.), it is offline
          newStatus = 'offline';
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
