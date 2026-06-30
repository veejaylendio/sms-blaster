'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ContactGroup {
  id: string;
  name: string;
  created_at: string;
}

function DeleteContactGroupButton({ groupId }: { groupId: string }) {
  const supabase = useSupabase(); // Use the hook
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('contact_groups').delete().eq('id', groupId);
    if (error) {
      toast.error('Failed to delete contact group.', { description: error.message });
    } else {
      toast.success('Contact group deleted successfully!');
      router.refresh(); // Re-fetch contact groups after deletion
    }
    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={loading}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this contact group
            and disassociate all contacts from it (contacts will NOT be deleted).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ContactGroupsPage() {
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const supabase = useSupabase(); // Use the hook

  useEffect(() => {
    const fetchContactGroups = async () => {
      setLoadingGroups(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoadingGroups(false);
        return;
      }

      const { data, error } = await supabase
        .from('contact_groups')
        .select('id, name, created_at')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching contact groups:', error);
        toast.error('Error loading contact groups.', { description: error.message });
      } else {
        setContactGroups(data as ContactGroup[]);
      }
      setLoadingGroups(false);
    };
    fetchContactGroups();
  }, [supabase]); // Depend on supabase to re-fetch if it changes (though it shouldn't here)

  if (loadingGroups) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Your Contact Groups</h1>
        <p>Loading contact groups...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Contact Groups</h1>
        <Button asChild>
          <Link href="/dashboard/contact-groups/add">Create New Group</Link>
        </Button>
      </div>

      {contactGroups && contactGroups.length > 0 ? (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Group Name</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Created At</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
          </table>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(5 * 3.25rem)" }}>
            <table className="w-full caption-bottom text-sm">
              <tbody className="[&_tr:last-child]:border-0">
                {contactGroups.map((group) => (
                  <tr key={group.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{group.name}</td>
                    <td className="p-4 align-middle">{new Date(group.created_at).toLocaleDateString()}</td>
                    <td className="p-4 align-middle">
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/contact-groups/${group.id}/edit`}>Edit</Link>
                        </Button>
                        <DeleteContactGroupButton groupId={group.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p>No contact groups found. Create your first group!</p>
      )}
    </div>
  );
}
