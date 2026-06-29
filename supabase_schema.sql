-- Create profiles table
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  full_name text,
  avatar_url text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create contact_groups table (Must be created before contacts table)
CREATE TABLE public.contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  CONSTRAINT unique_group_name_per_user UNIQUE (user_id, name)
);
ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contact groups." ON public.contact_groups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create contacts table
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  first_name text NOT NULL,
  last_name text,
  birthday date,
  phone_number text NOT NULL,
  group_id uuid REFERENCES public.contact_groups (id) ON DELETE SET NULL,
  CONSTRAINT unique_phone_per_user UNIQUE (user_id, phone_number)
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contacts." ON public.contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create android_devices table
CREATE TABLE public.android_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  device_name text NOT NULL,
  device_id text NOT NULL UNIQUE, -- Unique ID from Android device
  last_seen_at timestamptz,
  status text DEFAULT 'offline' NOT NULL, -- 'online', 'offline', 'unavailable', 'pending'
  api_key_hash text NOT NULL, -- Hashed API key for device authentication
  device_type text DEFAULT 'native' NOT NULL, -- 'native' or 'mymobkit'
  gateway_url text, -- URL for mymobkit push API
  CONSTRAINT unique_device_id_per_user UNIQUE (user_id, device_id),
  CONSTRAINT valid_device_status CHECK (status IN ('online', 'offline', 'unavailable', 'pending'))
);
ALTER TABLE public.android_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own android devices." ON public.android_devices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create sms_campaigns table
CREATE TABLE public.sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  message_content text NOT NULL,
  status text DEFAULT 'draft' NOT NULL, -- 'draft', 'scheduled', 'sending', 'completed', 'cancelled'
  scheduled_at timestamptz,
  recurrence_pattern text, -- e.g., 'daily', 'weekly', 'monthly', or cron expression
  send_to_type text NOT NULL, -- 'single_contact', 'group', 'multiple_contacts', 'all_contacts'
  target_group_id uuid REFERENCES public.contact_groups (id) ON DELETE SET NULL,
  target_contact_ids uuid[], -- Array of contact IDs
  CONSTRAINT valid_send_to_type CHECK (send_to_type IN ('single_contact', 'group', 'multiple_contacts', 'all_contacts'))
);
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sms campaigns." ON public.sms_campaigns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create sms_messages table
CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  campaign_id uuid REFERENCES public.sms_campaigns (id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE CASCADE NOT NULL,
  android_device_id uuid REFERENCES public.android_devices (id) ON DELETE SET NULL,
  message_content text NOT NULL,
  status text DEFAULT 'pending' NOT NULL, -- 'pending', 'sending', 'sent', 'failed', 'delivered', 'read'
  scheduled_send_at timestamptz NOT NULL, -- When it was supposed to be sent
  actual_send_at timestamptz, -- When it was actually sent by the device
  delivery_report jsonb,
  failure_reason text,
  retry_count integer DEFAULT 0 NOT NULL,
  CONSTRAINT valid_sms_status CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'delivered', 'read'))
);
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sms messages." ON public.sms_messages
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.contacts WHERE contacts.id = sms_messages.contact_id AND contacts.user_id = auth.uid()));
CREATE POLICY "Allow devices to update status." ON public.sms_messages
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.android_devices WHERE android_devices.id = sms_messages.android_device_id AND android_devices.user_id = auth.uid()));
CREATE POLICY "Users can insert their own sms messages via campaigns." ON public.sms_messages
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.contacts WHERE contacts.id = sms_messages.contact_id AND contacts.user_id = auth.uid()));

-- Indexes for hot filter columns
CREATE INDEX idx_sms_messages_status ON public.sms_messages (status);
CREATE INDEX idx_sms_messages_android_device_id ON public.sms_messages (android_device_id);
CREATE INDEX idx_sms_messages_contact_id ON public.sms_messages (contact_id);
CREATE INDEX idx_android_devices_device_id ON public.android_devices (device_id);
CREATE INDEX idx_android_devices_user_id_status ON public.android_devices (user_id, status);

-- Enable realtime broadcasts for sms_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;