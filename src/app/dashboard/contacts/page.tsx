'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { 
  Search, 
  UserPlus, 
  Upload, 
  Trash2, 
  Edit2, 
  Users
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  birthday: string | null;
  phone_number: string;
  contact_group_memberships: { contact_groups: { name: string } | null }[] | null;
}

function DeleteContactButton({ contactId, onDelete }: { contactId: string, onDelete: () => void }) {
  const supabase = useSupabase();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (error) {
      toast.error('Failed to delete contact.', { description: error.message });
    } else {
      toast.success('Contact deleted successfully!');
      onDelete(); // Immediate local state update
    }
    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Contact</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure? This will permanently remove the contact from your list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-red-600 hover:bg-red-700">
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = useSupabase();

  useEffect(() => {
    const fetchContacts = async () => {
      setLoadingContacts(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoadingContacts(false);
        return;
      }

      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, birthday, phone_number, contact_group_memberships(contact_groups(name))')
        .eq('user_id', user.id)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching contacts:', error);
        toast.error('Error loading contacts.', { description: error.message });
      } else {
        setContacts(data as Contact[]);
      }
      setLoadingContacts(false);
    };
    fetchContacts();
  }, [supabase]);

  const filteredContacts = contacts.filter(c => {
    const fullName = `${c.first_name} ${c.last_name || ''}`.trim().toLowerCase();
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      c.phone_number.includes(searchQuery)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white text-glow">Contacts</h1>
          <p className="text-text-muted text-sm mt-1">Manage and organize your recipients.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" asChild className="border-white/10 hover:bg-white/5">
            <Link href="/dashboard/contacts/import">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Link>
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(168,150,255,0.3)]" asChild>
            <Link href="/dashboard/contacts/add">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      <div className="glass-card border-white/5 bg-white/2 overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input 
              placeholder="Search contacts..." 
              className="pl-10 bg-black/20 border-white/10 focus:border-accent/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loadingContacts ? (
          <div className="p-20 text-center text-text-muted animate-pulse">Loading your contacts...</div>
        ) : filteredContacts && filteredContacts.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => {
                  const fullName = `${contact.first_name} ${contact.last_name || ''}`.trim();
                  return (
                    <TableRow key={contact.id} className="group">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full border border-accent/30 bg-accent/5 flex items-center justify-center text-accent text-xs font-bold shadow-[0_0_10px_rgba(168,150,255,0.1)] group-hover:shadow-[0_0_15px_rgba(168,150,255,0.3)] transition-all">
                            {contact.first_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-white group-hover:text-accent transition-colors">{fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-text-muted group-hover:text-white transition-colors">{contact.phone_number}</TableCell>
                      <TableCell>
                        {(() => {
                          const groupNames = (contact.contact_group_memberships ?? [])
                            .map((m) => m.contact_groups?.name)
                            .filter(Boolean) as string[];
                          if (groupNames.length === 0) {
                            return (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-white/5 text-text-muted border-white/10">
                                No Group
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-accent/10 text-accent border-accent/20">
                                {groupNames[0]}
                              </span>
                              {groupNames.length > 1 && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-white/5 text-text-muted border-white/10">
                                  +{groupNames.length - 1} more
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center space-x-1">
                          <Button variant="ghost" size="icon" className="text-text-muted hover:text-accent hover:bg-accent/10" asChild>
                            <Link href={`/dashboard/contacts/${contact.id}/edit`}>
                              <Edit2 className="w-4 h-4" />
                            </Link>
                          </Button>
                          <DeleteContactButton
                            contactId={contact.id}
                            onDelete={() => {
                              setContacts(prev => prev.filter(c => c.id !== contact.id));
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/10 shadow-[0_0_30px_rgba(168,150,255,0.05)]">
              <Users className="w-10 h-10 text-accent/40" />
            </div>
            <h3 className="text-xl font-bold text-white">No contacts found</h3>
            <p className="text-text-muted max-w-xs mx-auto mt-2 text-sm">
              {searchQuery ? `No results for "${searchQuery}"` : 'Start building your audience by adding or importing contacts.'}
            </p>
            {!searchQuery && (
              <Button className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_15px_rgba(168,150,255,0.3)] px-8" asChild>
                <Link href="/dashboard/contacts/add">Add your first contact</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
