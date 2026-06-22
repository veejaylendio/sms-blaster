'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { validateAndNormalizePhoneNumber } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  phone_number: z.string().superRefine((val, ctx) => {
    const result = validateAndNormalizePhoneNumber(val);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error,
      });
    }
  }),
  group_id: z.string().uuid().nullable().optional().or(z.literal('none')),
});

type ContactFormValues = z.infer<typeof formSchema>;

interface ContactFormProps {
  initialData?: ContactFormValues;
  contactId?: string; // Only present for edit mode
}

interface ContactGroup {
  id: string;
  name: string;
}

export function ContactForm({ initialData, contactId }: ContactFormProps) {
  const router = useRouter();
  const supabase = useSupabase(); // Use the hook
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      phone_number: '',
      group_id: 'none',
    },
  });

  useEffect(() => {
    const fetchContactGroups = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingGroups(false);
        return;
      }

      const { data, error } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching contact groups:', error);
        toast.error('Failed to load contact groups.', { description: error.message });
      } else {
        setContactGroups(data || []);
      }
      setLoadingGroups(false);
    };

    fetchContactGroups();
  }, [supabase]);

  const onSubmit = async (values: ContactFormValues) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { normalized } = validateAndNormalizePhoneNumber(values.phone_number);

      // Coerce 'none' or empty string group_id to null for Supabase
      const submissionValues = {
        ...values,
        phone_number: normalized || values.phone_number,
        user_id: user.id,
        group_id: (values.group_id === 'none' || values.group_id === '') ? null : values.group_id,
      };

      if (contactId) {
        // Edit mode
        const { error } = await supabase
          .from('contacts')
          .update(submissionValues)
          .eq('id', contactId);

        if (error) throw error;
        toast.success('Contact updated successfully!');
      } else {
        // Add mode
        const { error } = await supabase.from('contacts').insert(submissionValues);

        if (error) throw error;
        toast.success('Contact added successfully!');
      }
      router.push('/dashboard/contacts');
      router.refresh();
    } catch (error: any) {
      toast.error('Failed to save contact.', {
        description: error.message,
      });
    }
  };

  return (
    <Card className="max-w-xl mx-auto border-white/5 bg-white/2">
      <CardHeader>
        <CardTitle>{contactId ? 'Edit Contact' : 'New Contact'}</CardTitle>
        <CardDescription>
          {contactId 
            ? 'Update the details for this contact.' 
            : 'Fill in the information to add a new contact to your list.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <Label className="text-white">Full Name</Label>
                  <FormControl>
                    <Input placeholder="John Doe" className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <Label className="text-white">Phone Number</Label>
                  <FormControl>
                    <Input placeholder="09xxxxxxxxx or +63xxxxxxxxx" className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="group_id"
              render={({ field }) => (
                <FormItem>
                  <Label className="text-white">Contact Group</Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value || 'none'} disabled={loadingGroups}>
                    <FormControl>
                      <SelectTrigger className="bg-black/20 border-white/10 rounded-xl text-white">
                        <SelectValue placeholder="Select a group (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-white/10 text-white rounded-xl">
                      <SelectItem value="none">No Group</SelectItem>
                      {contactGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id} className="rounded-lg">
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingGroups && <p className="text-xs text-slate-400 mt-1">Loading groups...</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-4 flex items-center justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="border-white/10 hover:bg-white/5 text-white"
                onClick={() => router.back()}
                disabled={form.formState.isSubmitting || loadingGroups}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting || loadingGroups}
              >
                {form.formState.isSubmitting
                  ? 'Saving...'
                  : contactId
                  ? 'Update Contact'
                  : 'Create Contact'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
