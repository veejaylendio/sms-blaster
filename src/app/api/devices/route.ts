import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { checkAndUpdateDeviceStatuses } from '@/lib/sms/device-status';

// Helper function to hash API keys
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const devices = await checkAndUpdateDeviceStatuses(supabase, user.id);
    return NextResponse.json(devices);
  } catch (err: any) {
    console.error('Error checking device statuses:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve/check device statuses', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { device_name, device_type = 'native', gateway_url } = await req.json();

  if (!device_name) {
    return NextResponse.json(
      { error: 'Device name is required' },
      { status: 400 }
    );
  }

  const newDeviceId = uuidv4();
  const newApiKey = uuidv4(); // Generate a random UUID as API key
  const hashedApiKey = hashApiKey(newApiKey);

  const { data, error } = await supabase.from('android_devices').insert({
    user_id: user.id,
    device_name: device_name,
    device_id: newDeviceId,
    api_key_hash: hashedApiKey,
    device_type: device_type,
    gateway_url: gateway_url,
    status: 'pending', // Always start as pending until verified/connected
  });

  if (error) {
    console.error('Error registering device:', error);
    return NextResponse.json(
      { error: 'Failed to register device', details: error.message },
      { status: 500 }
    );
  }

  // Return the raw API key to the client ONCE for display (e.g., QR code)
  // The client must securely store this and never send it again.
  return NextResponse.json(
    {
      message: 'Device registered successfully',
      device_id: newDeviceId,
      api_key: newApiKey,
    },
    { status: 201 }
  );
}

