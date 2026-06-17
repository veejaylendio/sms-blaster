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

      // Basic CSV parsing (assuming header: name, phone, group)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const phoneIdx = headers.indexOf('phone');
      const groupIdx = headers.indexOf('group');

      if (nameIdx === -1 || phoneIdx === -1) {
        toast.error('CSV must have "name" and "phone" columns.');
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
        const name = values[nameIdx];
        const phone = values[phoneIdx];
        const groupName = groupIdx !== -1 ? values[groupIdx] : null;

        if (name && phone) {
          const { isValid, normalized } = validateAndNormalizePhoneNumber(phone);
          if (isValid && normalized) {
            contactsToInsert.push({ name, phone_number: normalized, groupName });
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
          name: c.name,
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
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Import Contacts</CardTitle>
          <CardDescription>
            Upload a CSV file with "name", "phone", and optionally "group" columns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
              />
            </div>
            <div className="flex justify-between gap-4">
              <Button
                type="button"
                variant="outline"
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
