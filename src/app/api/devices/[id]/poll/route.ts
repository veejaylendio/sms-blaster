import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyDeviceApiKey } from '@/lib/sms/auth';

export async function GET(
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

  try {
    // Update device status and last_seen_at
    await supabase
      .from('android_devices')
      .update({
        status: 'online',
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', devicePk);

    // Fetch pending SMS messages for this device primary key
    const { data: messagesToSend, error: fetchError } = await supabase
      .from('sms_messages')
      .select('id, contact_id, message_content, contacts(phone_number)')
      .eq('android_device_id', devicePk)
      .eq('status', 'pending')
      .limit(10); // Limit to a batch of 10 messages

    if (fetchError) {
      console.error('Error fetching pending SMS messages:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending messages', details: fetchError.message },
        { status: 500 }
      );
    }

    if (messagesToSend && messagesToSend.length > 0) {
      // Update status to 'sending'
      const messageIds = messagesToSend.map((msg) => msg.id);
      const { error: updateError } = await supabase
        .from('sms_messages')
        .update({ status: 'sending' })
        .in('id', messageIds);

      if (updateError) {
        console.error('Error updating SMS message status to sending:', updateError);
      }

      const formattedMessages = messagesToSend.map((msg: any) => {
        // Handle both object and array response for contacts join
        const contact = Array.isArray(msg.contacts) ? msg.contacts[0] : msg.contacts;
        return {
          sms_id: msg.id,
          phone_number: contact?.phone_number,
          message_content: msg.message_content,
        };
      });

      return NextResponse.json(formattedMessages, { status: 200 });
    }

    return NextResponse.json([], { status: 200 }); // No messages to send
  } catch (err: any) {
    console.error('Unhandled error in polling endpoint:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
