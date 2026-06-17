import { CampaignForm } from '@/components/campaigns/campaign-form';

export default function CreateCampaignPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create New SMS Campaign</h1>
      <CampaignForm />
    </div>
  );
}
