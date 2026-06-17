import { GroupForm } from '@/components/contact-groups/group-form';

export default function AddContactGroupPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create New Contact Group</h1>
      <GroupForm />
    </div>
  );
}
