import { ContactForm } from '@/components/contacts/contact-form';

export default function AddContactPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Add New Contact</h1>
      <ContactForm />
    </div>
  );
}
