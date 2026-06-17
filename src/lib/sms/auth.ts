import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function verifyDeviceApiKey(
  deviceId: string,
  apiKey: string
): Promise<{ isValid: boolean; userId: string | null; devicePk: string | null }> {
  const supabase = await createClient();
  const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  const { data: device, error } = await supabase
    .from('android_devices')
    .select('id, user_id, api_key_hash')
    .eq('device_id', deviceId)
    .single();

  if (error || !device) {
    console.error(`Device not found or error fetching device for ID: ${deviceId}`, error);
    return { isValid: false, userId: null, devicePk: null };
  }

  if (device.api_key_hash === hashedApiKey) {
    return { isValid: true, userId: device.user_id, devicePk: device.id };
  }

  return { isValid: false, userId: null, devicePk: null };
}
