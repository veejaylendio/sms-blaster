import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { GroupForm } from '@/components/contact-groups/group-form';

export default async function EditContactGroupPage({
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

  const { data: group, error } = await supabase
    .from('contact_groups')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !group) {
    console.error('Error fetching contact group for edit:', error);
    notFound();
  }

  const initialData = {
    name: group.name,
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Contact Group</h1>
      <GroupForm initialData={initialData} groupId={id} />
    </div>
  );
}
