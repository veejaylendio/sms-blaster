'use client';

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

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Group name must be at least 2 characters.',
  }),
});

type GroupFormValues = z.infer<typeof formSchema>;

interface GroupFormProps {
  initialData?: GroupFormValues;
  groupId?: string; // Only present for edit mode
}

export function GroupForm({ initialData, groupId }: GroupFormProps) {
  const router = useRouter();
  const supabase = useSupabase(); // Use the hook

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
    },
  });

  const onSubmit = async (values: GroupFormValues) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const submissionValues = {
        ...values,
        user_id: user.id,
      };

      if (groupId) {
        // Edit mode
        const { error } = await supabase
          .from('contact_groups')
          .update(submissionValues)
          .eq('id', groupId);

        if (error) throw error;
        toast.success('Contact group updated successfully!');
      } else {
        // Add mode
        const { error } = await supabase.from('contact_groups').insert(submissionValues);

        if (error) throw error;
        toast.success('Contact group added successfully!');
      }
      router.push('/dashboard/contact-groups');
      router.refresh();
    } catch (error: any) {
      toast.error('Failed to save contact group.', {
        description: error.message,
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <Label className="text-white">Group Name</Label>
              <FormControl>
                <Input placeholder="Family, Friends, Clients" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? 'Saving...'
            : groupId
            ? 'Save Changes'
            : 'Create Group'}
        </Button>
      </form>
    </Form>
  );
}
