'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSupabase } from '@/components/supabase-provider';
import { validateAndNormalizePhoneNumber } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ImportContactsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const router = useRouter();
  const supabase = useSupabase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a CSV file.');
      return;
    }

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      const lines = csvData.split(/\r?\n/);
      
      if (lines.length < 2) {
        toast.error('CSV file is empty or has no data.');
        setImporting(false);
        return;
      }

      // Basic CSV parsing (assuming header: first_name, last_name, phone, group, birthday)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const firstNameIdx = headers.indexOf('first_name');
      const lastNameIdx = headers.indexOf('last_name');
      const nameIdx = headers.indexOf('name');
      const phoneIdx = headers.indexOf('phone');
      const groupIdx = headers.indexOf('group');
      const birthdayIdx = headers.indexOf('birthday');

      if ((firstNameIdx === -1 && nameIdx === -1) || phoneIdx === -1) {
        toast.error('CSV must have "first_name" (or "name") and "phone" columns.');
        setImporting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User session not found.');
        setImporting(false);
        return;
      }

      const contactsToInsert = [];
      const groupsToCreate = new Set<string>();
      let invalidCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        const firstName = firstNameIdx !== -1 ? values[firstNameIdx] : nameIdx !== -1 ? values[nameIdx] : '';
        const lastName = lastNameIdx !== -1 ? values[lastNameIdx] : null;
        const phone = values[phoneIdx];
        const groupName = groupIdx !== -1 ? values[groupIdx] : null;
        const birthday = birthdayIdx !== -1 ? values[birthdayIdx] || null : null;

        if (firstName && phone) {
          const { isValid, normalized } = validateAndNormalizePhoneNumber(phone);
          if (isValid && normalized) {
            contactsToInsert.push({ firstName, lastName, phone_number: normalized, groupName, birthday });
            if (groupName) groupsToCreate.add(groupName);
          } else {
            invalidCount++;
          }
        }
      }

      if (contactsToInsert.length === 0) {
        toast.error('No valid contacts found in CSV.', {
          description: invalidCount > 0 ? `${invalidCount} numbers were invalid.` : undefined
        });
        setImporting(false);
        return;
      }

      try {
        // 1. Handle Groups
        const groupMap: Record<string, string> = {};
        for (const groupName of Array.from(groupsToCreate)) {
          // Check if group exists or create it
          const { data: existingGroup } = await supabase
            .from('contact_groups')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', groupName)
            .single();

          if (existingGroup) {
            groupMap[groupName] = existingGroup.id;
          } else {
            const { data: newGroup, error: groupError } = await supabase
              .from('contact_groups')
              .insert({ user_id: user.id, name: groupName })
              .select('id')
              .single();
            
            if (groupError) throw groupError;
            groupMap[groupName] = newGroup.id;
          }
        }

        // 2. Insert Contacts
        const finalContacts = contactsToInsert.map(c => ({
          user_id: user.id,
          first_name: c.firstName,
          last_name: c.lastName,
          birthday: c.birthday,
          phone_number: c.phone_number,
          group_id: c.groupName ? groupMap[c.groupName] : null
        }));

        const { error: insertError } = await supabase
          .from('contacts')
          .insert(finalContacts);

        if (insertError) throw insertError;

        toast.success(`Successfully imported ${finalContacts.length} contacts!`, {
          description: invalidCount > 0 ? `${invalidCount} invalid numbers were skipped.` : undefined
        });
        router.push('/dashboard/contacts');
        router.refresh();
      } catch (error: any) {
        console.error('Import error:', error);
        toast.error('Import failed', { description: error.message });
      } finally {
        setImporting(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto border-white/5 bg-white/2">
        <CardHeader>
          <CardTitle>Import Contacts</CardTitle>
          <CardDescription>
            Upload a CSV file with &quot;first_name&quot;, &quot;phone&quot;, and optionally &quot;last_name&quot;, &quot;birthday&quot;, and &quot;group&quot; columns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile" className="text-white">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
                className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white cursor-pointer"
              />
            </div>
            <div className="pt-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 hover:bg-white/5 text-white"
                onClick={() => router.back()}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={importing || !file}>
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
