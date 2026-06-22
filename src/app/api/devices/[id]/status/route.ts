import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDeviceApiKey } from '@/lib/sms/auth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await context.params;
  const deviceId = resolvedParams.id;
  const apiKey = req.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'X-API-Key header missing' }, { status: 401 });
  }

  const { isValid, devicePk } = await verifyDeviceApiKey(deviceId, apiKey);

  if (!isValid || !devicePk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Update device status and last_seen_at as it's active
  await supabase
    .from('android_devices')
    .update({
      status: 'online',
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', devicePk);

  const updates: Array<{
    sms_id: string;
    status: string;
    delivery_report?: any;
    failure_reason?: string;
  }> = await req.json();

  if (!Array.isArray(updates)) {
    return NextResponse.json(
      { error: 'Invalid payload: expected an array of updates' },
      { status: 400 }
    );
  }

  const updatePromises = updates.map(async (update) => {
    const { sms_id, status, delivery_report, failure_reason } = update;
    return supabase
      .from('sms_messages')
      .update({
        status: status,
        delivery_report: delivery_report || null,
        failure_reason: failure_reason || null,
        actual_send_at: new Date().toISOString(), // Update actual send time
      })
      .eq('id', sms_id)
      .eq('android_device_id', devicePk) // Ensure device is authorized to update this message
      .select('id'); // Select ID to confirm update
  });

  try {
    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter((res) => !res.error && res.data.length > 0).length;

    return NextResponse.json(
      { message: `Updated status for ${updatedCount} messages.`, updatedCount },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Error updating SMS message statuses:', err);
    return NextResponse.json(
      { error: 'Failed to update message statuses', details: err.message },
      { status: 500 }
    );
  }
}
