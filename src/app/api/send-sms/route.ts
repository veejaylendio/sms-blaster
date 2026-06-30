import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processPendingMessages } from '@/lib/sms/processor';
import { checkAndUpdateDeviceStatuses } from '@/lib/sms/device-status';
import { resolveMergeTags, MERGE_FIELDS, type MergeableContact } from '@/lib/sms/merge-tags';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sendToType, groupId, contactIds, messageContent } = await req.json();

    if (!messageContent || messageContent.trim() === '') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (!sendToType) {
      return NextResponse.json({ error: 'Target audience type is required' }, { status: 400 });
    }

    // Update and check device statuses before fetching online devices
    try {
      await checkAndUpdateDeviceStatuses(supabase, user.id);
    } catch (statusErr) {
      console.error('Error updating device statuses in send-sms route:', statusErr);
    }

    // 1. Fetch online devices for the user
    const { data: devices, error: devicesError } = await supabase
      .from('android_devices')
      .select('id, device_type, status')
      .eq('user_id', user.id)
      .eq('status', 'online');

    if (devicesError) {
      console.error('Error fetching online devices:', devicesError);
      return NextResponse.json({ error: 'Failed to fetch online devices' }, { status: 500 });
    }

    if (!devices || devices.length === 0) {
      return NextResponse.json(
        { error: 'No online Android gateways found. Please connect a device and make sure it is online first.' },
        { status: 400 }
      );
    }

    // 2. Resolve contacts to message
    let contactsQuery = supabase
      .from('contacts')
      .select('id, first_name, last_name, phone_number, birthday')
      .eq('user_id', user.id);

    if (sendToType === 'group') {
      if (!groupId) {
        return NextResponse.json({ error: 'Group ID is required for group sends' }, { status: 400 });
      }
      contactsQuery = contactsQuery.eq('group_id', groupId);
    } else if (sendToType === 'multiple_contacts') {
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return NextResponse.json({ error: 'No contacts selected' }, { status: 400 });
      }
      contactsQuery = contactsQuery.in('id', contactIds);
    }

    const { data: targetContacts, error: contactsError } = await contactsQuery;

    if (contactsError) {
      console.error('Error fetching target contacts:', contactsError);
      return NextResponse.json({ error: 'Failed to retrieve target contacts' }, { status: 500 });
    }

    if (!targetContacts || targetContacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found matching the target criteria.' }, { status: 400 });
    }

    // 3. Create messages and assign devices round-robin
    const messagesToInsert = targetContacts.map((contact, index) => {
      const assignedDevice = devices[index % devices.length];
      return {
        contact_id: contact.id,
        android_device_id: assignedDevice.id,
        message_content: resolveMergeTags(
          messageContent,
          contact as unknown as MergeableContact,
          MERGE_FIELDS
        ),
        status: 'pending',
        scheduled_send_at: new Date().toISOString(),
      };
    });

    // 4. Insert messages
    const { error: insertError } = await supabase
      .from('sms_messages')
      .insert(messagesToInsert);

    if (insertError) {
      console.error('Error inserting SMS messages:', insertError);
      return NextResponse.json({ error: 'Failed to queue SMS messages', details: insertError.message }, { status: 500 });
    }

    // 5. Trigger immediate processing for mymobkit devices
    const hasMymobkit = devices.some((d) => d.device_type === 'mymobkit');
    let processedCount = 0;

    if (hasMymobkit) {
      try {
        const processResult = await processPendingMessages();
        if (processResult.success && typeof processResult.processed === 'number') {
          processedCount = processResult.processed;
        }
      } catch (procErr) {
        console.error('Failed to run immediate processor for mymobkit:', procErr);
        // Do not crash the API request as the database inserts were successful
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${messagesToInsert.length} messages.`,
      queuedCount: messagesToInsert.length,
      processedMymobkitCount: processedCount,
    });
  } catch (err: any) {
    console.error('Unhandled error in send-sms endpoint:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
