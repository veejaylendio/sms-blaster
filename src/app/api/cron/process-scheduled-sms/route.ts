import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processPendingMessages } from '@/lib/sms/processor';

const MAX_RETRIES = 3;

export async function GET(req: NextRequest) {
  // CRON IS CURRENTLY DISABLED AS PER USER REQUEST
  // To enable, set ENABLE_CRON=true in your environment variables
  if (process.env.ENABLE_CRON !== 'true') {
    return NextResponse.json({ message: 'Cron job is currently disabled.' }, { status: 200 });
  }

  // Securely verify the request using CRON_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = await createClient();

  try {
    // --- 1. Identify Due Campaigns ---
    const { data: campaigns, error: campaignsError } = await supabase
      .from('sms_campaigns')
      .select('id, user_id, message_content, send_to_type, target_group_id, target_contact_ids')
      .in('status', ['scheduled', 'sending']) // Also process 'sending' campaigns in case of previous failures
      .lt('scheduled_at', new Date().toISOString());

    if (campaignsError) {
      console.error('Error fetching scheduled campaigns:', campaignsError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled campaigns', details: campaignsError.message },
        { status: 500 }
      );
    }

    let messagesCreatedCount = 0;
    let messagesRetriedCount = 0;

    for (const campaign of campaigns || []) {
      // --- 2. Generate sms_messages & Assign Devices ---
      const { data: userDevices, error: devicesError } = await supabase
        .from('android_devices')
        .select('id')
        .eq('user_id', campaign.user_id)
        .eq('status', 'online'); // Only use online devices

      if (devicesError) {
        console.error(`Error fetching online devices for user ${campaign.user_id}:`, devicesError);
        continue;
      }
      const availableDeviceIds = userDevices?.map((device) => device.id) || [];

      if (availableDeviceIds.length === 0) {
        console.warn(`No online devices available for user ${campaign.user_id}. Campaign ${campaign.id} will be skipped.`);
        // Optionally update campaign status to 'paused' or similar
        continue;
      }

      let targetContactIds: string[] = [];

      if (campaign.send_to_type === 'all_contacts') {
        const { data: contactsData, error } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', campaign.user_id);
        if (error) {
          console.error('Error fetching all contacts for campaign:', error);
          continue;
        }
        targetContactIds = contactsData.map((c) => c.id);
      } else if (campaign.send_to_type === 'group' && campaign.target_group_id) {
        const { data: contactsData, error } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', campaign.user_id)
          .eq('group_id', campaign.target_group_id);
        if (error) {
          console.error('Error fetching group contacts for campaign:', error);
          continue;
        }
        targetContactIds = contactsData.map((c) => c.id);
      } else if (campaign.send_to_type === 'multiple_contacts' && campaign.target_contact_ids) {
        targetContactIds = campaign.target_contact_ids;
      }
      // For 'single_contact', the message would have been generated directly.

      // Filter out contacts for whom an SMS message for this campaign already exists and is not 'failed' or 'pending'
      const { data: existingMessages, error: existingMessagesError } = await supabase
        .from('sms_messages')
        .select('contact_id')
        .eq('campaign_id', campaign.id)
        .not('status', 'in', ['failed', 'pending']); // Exclude failed/pending to allow retries/new creation

      if (existingMessagesError) {
        console.error('Error fetching existing messages for campaign:', existingMessagesError);
        continue;
      }
      const existingContactIds = new Set(existingMessages?.map(msg => msg.contact_id));
      const contactsToMessage = targetContactIds.filter(contactId => !existingContactIds.has(contactId));


      const messagesToInsert = contactsToMessage.map((contactId, index) => ({
        campaign_id: campaign.id,
        contact_id: contactId,
        android_device_id: availableDeviceIds[index % availableDeviceIds.length], // Round-robin assignment
        message_content: campaign.message_content,
        status: 'pending',
        scheduled_send_at: new Date().toISOString(), // Mark as scheduled now
      }));

      if (messagesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('sms_messages')
          .insert(messagesToInsert);

        if (insertError) {
          console.error('Error inserting SMS messages for campaign:', insertError);
        } else {
          messagesCreatedCount += messagesToInsert.length;
          console.log(`Created ${messagesToInsert.length} messages for campaign ${campaign.id}`);
        }
      }

      // --- 4. Update Campaign Status ---
      // If all messages generated, set campaign to 'sending'
      await supabase.from('sms_campaigns').update({ status: 'sending' }).eq('id', campaign.id);
    }

    // --- 5. Retry Logic for Failed Messages ---
    const { data: failedMessages, error: failedMessagesError } = await supabase
      .from('sms_messages')
      .select('id, user_id, retry_count')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES);

    if (failedMessagesError) {
      console.error('Error fetching failed messages for retry:', failedMessagesError);
    } else {
      for (const failedMsg of failedMessages || []) {
        const { data: userDevices, error: devicesError } = await supabase
          .from('android_devices')
          .select('id')
          .eq('user_id', failedMsg.user_id)
          .eq('status', 'online');

        if (devicesError) {
          console.error(`Error fetching online devices for user ${failedMsg.user_id} during retry:`, devicesError);
          continue;
        }
        const availableDeviceIds = userDevices?.map((device) => device.id) || [];

        if (availableDeviceIds.length > 0) {
          const { error: updateError } = await supabase
            .from('sms_messages')
            .update({
              status: 'pending',
              retry_count: failedMsg.retry_count + 1,
              android_device_id: availableDeviceIds[0], // Assign to first available device
            })
            .eq('id', failedMsg.id);

          if (updateError) {
            console.error(`Error retrying message ${failedMsg.id}:`, updateError);
          } else {
            messagesRetriedCount++;
            console.log(`Retried message ${failedMsg.id}, new retry_count: ${failedMsg.retry_count + 1}`);
          }
        } else {
          console.warn(`No online devices available for user ${failedMsg.user_id}. Message ${failedMsg.id} cannot be retried.`);
        }
      }
    }

    // --- 6. Process Push Gateways (like Mymobkit) ---
    await processPendingMessages();

    return NextResponse.json(
      {
        message: 'Cron job executed successfully',
        messagesCreated: messagesCreatedCount,
        messagesRetried: messagesRetriedCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unhandled error in cron job:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
