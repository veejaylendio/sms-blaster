# Technical Documentation: SMS Blaster

## System Overview
SMS Blaster is a web-based platform designed to manage and automate SMS campaigns using Android devices as gateways. It leverages a modern tech stack to provide a scalable and secure solution for mass messaging.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security)
- **Styling**: Tailwind CSS, Shadcn UI
- **SMS Gateway**: Custom Android Integration (Native Polling) & [Mymobkit](https://www.mymobkit.com/)

## Architecture

### Component Interaction
1.  **Dashboard (Next.js)**: The user interface where campaigns are managed, contacts are imported, and devices are registered.
2.  **Supabase Backend**: Stores all application data. Row Level Security (RLS) ensures that users can only access their own data.
3.  **Cron Job**: A scheduled worker that processes due campaigns, generates individual messages, and handles retries.
4.  **Android Devices**: Act as the physical gateway to send SMS.

## Database Schema

### `profiles`
Extends Supabase Auth users with additional metadata.
- `id`: UUID (FK to auth.users)
- `full_name`: Text
- `avatar_url`: Text

### `contact_groups`
Logical grouping of contacts for targeted campaigns.
- `user_id`: UUID (FK to auth.users)
- `name`: Text

### `contacts`
Individual contact records.
- `user_id`: UUID
- `first_name`: Text
- `last_name`: Text (optional)
- `birthday`: Date (optional)
- `phone_number`: Text (Unique per user)
- `group_id`: UUID (FK to contact_groups)

### `android_devices`
Registered Android gateways.
- `device_id`: Unique identifier (UUID)
- `api_key_hash`: SHA-256 hash of the device's API key.
- `device_type`: `native` or `mymobkit`.
- `status`: `online`, `offline`, `pending`.
- `gateway_url`: Used for Mymobkit push API.

### `sms_campaigns`
Campaign templates and scheduling.
- `status`: `draft`, `scheduled`, `sending`, `completed`, `cancelled`.
- `send_to_type`: `all_contacts`, `group`, `multiple_contacts`, `single_contact`.
- `scheduled_at`: Timestamp for execution.
- `recurrence_pattern`: Optional cron-style or simple frequency (e.g., 'daily').

### `sms_messages`
Individual SMS records generated from campaigns.
- `status`: `pending`, `sent`, `failed`, `delivered`.
- `android_device_id`: Assigned device for sending.
- `retry_count`: Tracks delivery attempts.

## SMS Delivery Logic

### 1. Campaign Unpacking
The cron job (located at `/api/cron/process-scheduled-sms`) identifies campaigns with `status='scheduled'` where `scheduled_at` is in the past. It then:
- Fetches the target contacts.
- Assigns messages to online devices using a round-robin algorithm.
- Creates records in the `sms_messages` table with `status='pending'`.

### 2. Message Transmission
There are two primary modes of transmission:

#### Native Mode (Pull)
- The Android device periodically polls the `/api/devices/[id]/poll` endpoint.
- The device authenticates using its `X-API-Key`.
- The server returns a batch of pending messages.
- The device sends the SMS and updates the status via `/api/devices/[id]/status` (Implementation pending/standard flow).

#### Mymobkit Mode (Push)
- The server pushes messages directly to the device's gateway URL via the Mymobkit REST API.
- Handled by `src/lib/sms/processor.ts`.

## Security
- **API Security**: Devices use a unique API key sent in the `X-API-Key` header. Keys are stored as SHA-256 hashes in the database.
- **Data Isolation**: PostgreSQL Row Level Security (RLS) ensures users cannot see or modify other users' contacts, campaigns, or devices.
- **Cron Security**: The cron endpoint requires a `Bearer` token matching the `CRON_SECRET` environment variable.

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations (if needed).
- `CRON_SECRET`: Secret token to authorize cron job requests.
- `ENABLE_CRON`: Set to `true` to enable the cron job logic.
- `ANDROID_SMS_API_URL`: (Optional) Global gateway URL for Mymobkit devices.
