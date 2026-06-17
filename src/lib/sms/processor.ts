import { createClient } from '@/lib/supabase/server';
import { sendSmsViaMymobkit } from './mymobkit';

export async function processPendingMessages() {
  const supabase = await createClient();

  // 1. Fetch pending messages that are assigned to mymobkit devices
  const { data: messages, error } = await supabase
    .from('sms_messages')
    .select(`
      id,
      message_content,
      contacts (phone_number),
      android_devices (
        id,
        device_type,
        gateway_url,
        status
      )
    `)
    .eq('status', 'pending')
    .eq('android_devices.device_type', 'mymobkit');

  if (error) {
    console.error('Error fetching pending messages for mymobkit:', error);
    return { success: false, error };
  }

  if (!messages || messages.length === 0) {
    return { success: true, processed: 0 };
  }

  const results = await Promise.all(
    messages.map(async (msg: any) => {
      const device = msg.android_devices;
      // Handle both object and array response for contacts join
      const contact = Array.isArray(msg.contacts) ? msg.contacts[0] : msg.contacts;
      
      // Prioritize environment variable if set, otherwise use the URL from the database
      const gatewayUrl = process.env.ANDROID_SMS_API_URL || device?.gateway_url;

      if (!device || !gatewayUrl || device.status !== 'online') {
        return { id: msg.id, success: false, error: 'Device not ready or missing gateway URL' };
      }

      try {
        // Update status to 'sending' first
        await supabase
          .from('sms_messages')
          .update({ status: 'sending' })
          .eq('id', msg.id);

        const response = await sendSmsViaMymobkit(
          gatewayUrl,
          contact?.phone_number,
          msg.message_content
        );

        if (response.isSuccessful) {
          await supabase
            .from('sms_messages')
            .update({
              status: 'sent',
              actual_send_at: new Date().toISOString(),
              delivery_report: response
            })
            .eq('id', msg.id);
          return { id: msg.id, success: true };
        } else {
          throw new Error(response.description || 'Mymobkit failed to send');
        }
      } catch (err: any) {
        console.error(`Failed to send message ${msg.id} via mymobkit:`, err);
        await supabase
          .from('sms_messages')
          .update({
            status: 'failed',
            failure_reason: err.message
          })
          .eq('id', msg.id);
        return { id: msg.id, success: false, error: err.message };
      }
    })
  );

  return {
    success: true,
    processed: results.length,
    results
  };
}
