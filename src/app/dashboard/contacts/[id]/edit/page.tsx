import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ContactForm } from '@/components/contacts/contact-form';

export default async function EditContactPage({
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
    notFound();
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, birthday, phone_number')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !contact) {
    console.error('Error fetching contact for edit:', error);
    notFound();
  }

  const { data: memberships } = await supabase
    .from('contact_group_memberships')
    .select('group_id')
    .eq('contact_id', id);

  const initialData = {
    first_name: contact.first_name,
    last_name: contact.last_name,
    birthday: contact.birthday,
    phone_number: contact.phone_number,
    group_ids: (memberships ?? []).map((m: { group_id: string }) => m.group_id),
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Contact</h1>
      <ContactForm initialData={initialData} contactId={id} />
    </div>
  );
}
