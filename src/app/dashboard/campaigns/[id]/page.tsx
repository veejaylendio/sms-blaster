import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CampaignForm } from '@/components/campaigns/campaign-form';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound(); // Should be protected by layout, but as a fallback
  }

  const { data: campaign, error } = await supabase
    .from('sms_campaigns')
    .select('*') // Select all fields for editing
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !campaign) {
    console.error('Error fetching campaign for edit:', error);
    notFound();
  }

  // Transform scheduled_at string to Date object for react-hook-form
  const initialData = {
    ...campaign,
    scheduled_at: campaign.scheduled_at ? new Date(campaign.scheduled_at) : null,
    // Ensure target_contact_ids is an array if null (for react-hook-form)
    target_contact_ids: campaign.target_contact_ids || [],
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit SMS Campaign</h1>
      <CampaignForm initialData={initialData} campaignId={id} />
    </div>
  );
}
