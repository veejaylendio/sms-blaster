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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Campaign name must be at least 2 characters.',
  }),
  message_content: z.string().min(1, {
    message: 'Message content cannot be empty.',
  }),
  status: z.enum(['draft', 'scheduled', 'sending', 'completed', 'cancelled']),
  scheduled_at: z.date().nullable().optional(),
  recurrence_pattern: z.string().nullable().optional(),
  send_to_type: z.enum(['single_contact', 'group', 'multiple_contacts', 'all_contacts']),
  target_group_id: z.string().uuid().nullable().optional(),
  target_contact_ids: z.array(z.string().uuid()).nullable().optional(),
}).refine((data) => {
  if (data.status === 'scheduled' && !data.scheduled_at) {
    return false;
  }
  return true;
}, {
  message: 'Scheduled time is required when status is "scheduled".',
  path: ['scheduled_at'],
}).refine((data) => {
  if (data.scheduled_at && data.scheduled_at < new Date()) {
    return false;
  }
  return true;
}, {
  message: 'Scheduled time must be in the future.',
  path: ['scheduled_at'],
});

type CampaignFormValues = z.infer<typeof formSchema>;

interface CampaignFormProps {
  initialData?: CampaignFormValues;
  campaignId?: string; // Only present for edit mode
}

interface ContactGroup {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
  phone_number: string;
}

export function CampaignForm({ initialData, campaignId }: CampaignFormProps) {
  const router = useRouter();
  const supabase = useSupabase(); // Use the hook
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingDependencies, setLoadingDependencies] = useState(true);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      message_content: '',
      status: 'draft',
      scheduled_at: null,
      recurrence_pattern: null,
      send_to_type: 'all_contacts',
      target_group_id: null,
      target_contact_ids: [],
    },
  });

  const sendToType = form.watch('send_to_type');

  useEffect(() => {
    const fetchDependencies = async () => {
      setLoadingDependencies(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoadingDependencies(false);
        return;
      }

      const { data: groups, error: groupsError } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (groupsError) {
        console.error('Error fetching contact groups:', groupsError);
        toast.error('Failed to load contact groups.', { description: groupsError.message });
      } else {
        setContactGroups(groups || []);
      }

      const { data: allContacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, phone_number')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
        toast.error('Failed to load contacts.', { description: contactsError.message });
      } else {
        setContacts(allContacts || []);
      }

      setLoadingDependencies(false);
    };

    fetchDependencies();
  }, [supabase]);

  const onSubmit = async (values: CampaignFormValues) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const submissionValues = {
        ...values,
        user_id: user.id,
        // Ensure scheduled_at is ISO string if present
        scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
        // Coerce empty string group_id to null
        target_group_id: values.target_group_id === '' ? null : values.target_group_id,
        // Ensure target_contact_ids is null if empty array
        target_contact_ids: values.target_contact_ids?.length === 0 ? null : values.target_contact_ids,
      };

      if (campaignId) {
        // Edit mode
        const { error } = await supabase
          .from('sms_campaigns')
          .update(submissionValues)
          .eq('id', campaignId);

        if (error) throw error;
        toast.success('Campaign updated successfully!');
      } else {
        // Add mode
        const { error } = await supabase.from('sms_campaigns').insert(submissionValues);

        if (error) throw error;
        toast.success('Campaign created successfully!');
      }
      router.push('/dashboard/campaigns');
      router.refresh();
    } catch (error: any) {
      toast.error('Failed to save campaign.', {
        description: error.message,
      });
    }
  };

  return (
    <Card className="max-w-2xl mx-auto border-slate-200 shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle>{campaignId ? 'Edit Campaign' : 'Create Campaign'}</CardTitle>
        <CardDescription>
          {campaignId 
            ? 'Update your campaign details and schedule.' 
            : 'Set up a new SMS campaign to blast to your contacts.'}
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
                  <Label className="text-white font-medium">Campaign Name</Label>
                  <FormControl>
                    <Input placeholder="Holiday Promotion" className="rounded-xl border-slate-200 focus:ring-blue-500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message_content"
              render={({ field }) => (
                <FormItem>
                  <Label className="text-white font-medium">Message Content</Label>
                  <FormControl>
                    <Textarea 
                      placeholder="Your SMS message here..." 
                      className="rounded-xl border-slate-200 min-h-[120px] focus:ring-blue-500" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white font-medium">Status</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl border-slate-200">
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sending">Sending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="send_to_type"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white font-medium">Target Audience</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl border-slate-200">
                          <SelectValue placeholder="Select audience" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all_contacts">All Contacts</SelectItem>
                        <SelectItem value="group">Specific Group</SelectItem>
                        <SelectItem value="multiple_contacts">Multiple Contacts</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Scheduling & Targeting</h3>
              
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="scheduled_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Label className="text-white font-medium mb-2">Scheduled Date & Time</Label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'flex-grow justify-start text-left font-normal rounded-xl border-slate-200 bg-white text-slate-950 h-11',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl border-slate-200" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={(date) => {
                                if (!date) return;
                                const current = field.value || new Date();
                                // If picking today, ensure time is not in the past
                                const now = new Date();
                                let hours = current.getHours();
                                let minutes = current.getMinutes();
                                
                                const selectedDate = new Date(date);
                                selectedDate.setHours(hours);
                                selectedDate.setMinutes(minutes);
                                
                                if (selectedDate < now) {
                                  // If the resulting time is in the past, default to now or next available slot
                                  hours = now.getHours();
                                  minutes = now.getMinutes() + 5; // Give 5 mins buffer
                                }
                                
                                date.setHours(hours);
                                date.setMinutes(minutes);
                                field.onChange(date);
                              }}
                              disabled={(date) => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                return date < today;
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        
                        <Input
                          type="time"
                          className="w-full sm:w-[180px] h-11 rounded-xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-500"
                          value={field.value ? format(field.value, 'HH:mm') : ''}
                          min={field.value && format(field.value, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? format(new Date(), 'HH:mm') : undefined}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            if (hours === undefined || minutes === undefined) return;
                            const date = field.value || new Date();
                            const newDate = new Date(date);
                            newDate.setHours(parseInt(hours));
                            newDate.setMinutes(parseInt(minutes));
                            field.onChange(newDate);
                          }}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recurrence_pattern"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Label className="text-white font-medium mb-2">Recurrence (Optional)</Label>
                      <FormControl>
                        <Input placeholder="daily, weekly, * * * * *" className="h-11 rounded-xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-500" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {sendToType === 'group' && (
                <FormField
                  control={form.control}
                  name="target_group_id"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-white font-medium">Target Group</Label>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || ''}
                        disabled={loadingDependencies}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-slate-200 bg-white text-slate-950">
                            <SelectValue placeholder="Select a group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {contactGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id} className="rounded-lg">
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {sendToType === 'multiple_contacts' && (
                <FormField
                  control={form.control}
                  name="target_contact_ids"
                  render={() => (
                    <FormItem>
                      <Label className="text-white font-medium">Selected Contacts</Label>
                      <FormControl>
                        <div className="border border-slate-200 bg-white rounded-xl p-4 max-h-[200px] overflow-y-auto space-y-2 shadow-inner">
                          {loadingDependencies ? (
                            <p className="text-xs text-slate-400">Loading contacts...</p>
                          ) : contacts.length > 0 ? (
                            contacts.map((contact) => (
                              <div key={contact.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`contact-${contact.id}`}
                                  checked={form.watch('target_contact_ids')?.includes(contact.id)}
                                  onChange={(e) => {
                                    const currentIds = form.getValues('target_contact_ids') || [];
                                    if (e.target.checked) {
                                      form.setValue('target_contact_ids', [...currentIds, contact.id]);
                                    } else {
                                      form.setValue(
                                        'target_contact_ids',
                                        currentIds.filter((id) => id !== contact.id)
                                      );
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Label
                                  htmlFor={`contact-${contact.id}`}
                                  className="text-sm font-normal cursor-pointer text-white"
                                >
                                  {contact.name} ({contact.phone_number})
                                </Label>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400">No contacts found.</p>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <Button 
                type="submit" 
                className="flex-grow rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm py-6 h-auto text-lg font-semibold transition-all active:scale-[0.98]" 
                disabled={form.formState.isSubmitting || loadingDependencies}
              >
                {form.formState.isSubmitting
                  ? 'Saving...'
                  : campaignId
                  ? 'Update Campaign'
                  : 'Create Campaign'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="rounded-xl border-slate-200 py-6 h-auto text-lg"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
