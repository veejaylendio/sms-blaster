# SMS Blaster Cron Job Setup

The SMS Blaster uses a cron job to process scheduled campaigns, create SMS messages, and trigger the sending process for gateways like Mymobkit.

## Current Status
The cron job is **DISABLED** by default in the code.

## How to Enable
To enable the cron job, you need to:

1.  **Set Environment Variables:**
    Add `ENABLE_CRON=true` to your `.env.local` or Vercel environment variables.
2.  **Set CRON_SECRET:**
    Set a strong `CRON_SECRET` in your environment variables.
3.  **Configure Vercel Cron (Optional):**
    If deploying to Vercel, the `vercel.json` is already configured to run the job every 5 minutes. You will need to ensure the request includes the `Authorization: Bearer YOUR_CRON_SECRET` header if triggering manually.

## Endpoint
The cron endpoint is: `/api/cron/process-scheduled-sms`

## What the Cron Job Does
1.  **Identifies Due Campaigns:** Looks for campaigns with status `scheduled` or `sending` where the `scheduled_at` time has passed.
2.  **Generates Messages:** For each due campaign, it finds online devices for the user and creates `sms_messages` in a round-robin fashion.
3.  **Retries Failed Messages:** Attempts to retry messages that failed to send, up to a maximum of 3 times.
4.  **Processes Push Gateways:** Specifically triggers `processPendingMessages()` which handles sending via Mymobkit gateways.
