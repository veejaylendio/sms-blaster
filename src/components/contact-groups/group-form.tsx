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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <Card className="max-w-xl mx-auto border-white/5 bg-white/2">
      <CardHeader>
        <CardTitle>{groupId ? 'Edit Contact Group' : 'New Contact Group'}</CardTitle>
        <CardDescription>
          {groupId 
            ? 'Update the name of this contact group.' 
            : 'Fill in the information to create a new contact group.'}
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
                  <Label className="text-white">Group Name</Label>
                  <FormControl>
                    <Input placeholder="Family, Friends, Clients" className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white" {...field} />
                  </FormControl>
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
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Saving...'
                  : groupId
                  ? 'Save Changes'
                  : 'Create Group'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
