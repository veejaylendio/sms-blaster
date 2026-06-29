'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { useSupabase } from '@/components/supabase-provider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { validateAndNormalizePhoneNumber } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const formSchema = z.object({
  first_name: z.string().min(1, { message: 'First name is required.' }),
  last_name: z.string().min(1, { message: 'Last name is required.' }),
  birthday: z.string().nullable().optional(),
  phone_number: z.string().superRefine((val, ctx) => {
    const result = validateAndNormalizePhoneNumber(val);
    if (!result.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    }
  }),
  group_ids: z.array(z.string().uuid()).optional(),
});

type ContactFormValues = z.infer<typeof formSchema>;

interface ContactFormProps {
  initialData?: Omit<ContactFormValues, 'group_ids'> & { group_ids?: string[] };
  contactId?: string;
}

interface ContactGroup {
  id: string;
  name: string;
}

export function ContactForm({ initialData, contactId }: ContactFormProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? { ...initialData, group_ids: initialData.group_ids ?? [] }
      : {
          first_name: '',
          last_name: '',
          birthday: '',
          phone_number: '',
          group_ids: [],
        },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const portalEl = document.querySelector('[data-group-dropdown]');
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        (!portalEl || !portalEl.contains(target))
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchContactGroups = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingGroups(false); return; }

      const { data, error } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
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

      const contactPayload = {
        first_name: values.first_name,
        last_name: values.last_name,
        birthday: values.birthday || null,
        phone_number: normalized || values.phone_number,
        user_id: user.id,
      };

      let resolvedContactId = contactId;

      if (contactId) {
        const { error } = await supabase
          .from('contacts')
          .update(contactPayload)
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert(contactPayload)
          .select('id')
          .single();
        if (error) throw error;
        resolvedContactId = data.id;
      }

      // Sync memberships: delete all then insert selected
      const { error: deleteError } = await supabase
        .from('contact_group_memberships')
        .delete()
        .eq('contact_id', resolvedContactId!);
      if (deleteError) throw deleteError;

      const selectedIds = values.group_ids ?? [];
      if (selectedIds.length > 0) {
        const { error: insertError } = await supabase
          .from('contact_group_memberships')
          .insert(selectedIds.map((gid) => ({ contact_id: resolvedContactId!, group_id: gid })));
        if (insertError) throw insertError;
      }

      toast.success(contactId ? 'Contact updated successfully!' : 'Contact added successfully!');
      router.push('/dashboard/contacts');
      router.refresh();
    } catch (error: any) {
      toast.error('Failed to save contact.', { description: error.message });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white">First Name</Label>
                    <FormControl>
                      <Input placeholder="John" className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-white">Last Name</Label>
                    <FormControl>
                      <Input placeholder="Doe" className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              name="birthday"
              render={({ field }) => (
                <FormItem>
                  <Label className="text-white">Birthday</Label>
                  <FormControl>
                    <Input
                      type="date"
                      className="bg-black/20 border-white/10 rounded-xl focus:border-accent/50 text-white"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_ids"
              render={({ field }) => {
                const selected: string[] = field.value ?? [];
                const toggle = (id: string) => {
                  field.onChange(
                    selected.includes(id)
                      ? selected.filter((x) => x !== id)
                      : [...selected, id]
                  );
                };
                const label =
                  selected.length === 0
                    ? 'Select Group'
                    : selected.length === 1
                    ? (contactGroups.find((g) => g.id === selected[0])?.name ?? '1 group')
                    : `${selected.length} groups selected`;

                const openDropdown = () => {
                  if (buttonRef.current) {
                    const rect = buttonRef.current.getBoundingClientRect();
                    setDropdownPos({
                      top: rect.bottom + window.scrollY + 4,
                      left: rect.left + window.scrollX,
                      width: rect.width,
                    });
                  }
                  setDropdownOpen((o) => !o);
                };

                return (
                  <FormItem>
                    <Label className="text-white">Contact Group</Label>
                    <div className="relative">
                      <button
                        ref={buttonRef}
                        type="button"
                        disabled={loadingGroups}
                        onClick={openDropdown}
                        className="w-full flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 disabled:opacity-50"
                      >
                        <span className={selected.length === 0 ? 'text-white/40' : 'text-white'}>
                          {loadingGroups ? 'Loading groups...' : label}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {dropdownOpen && !loadingGroups && typeof document !== 'undefined' && createPortal(
                        <div
                          data-group-dropdown
                          style={{
                            position: 'absolute',
                            top: dropdownPos.top,
                            left: dropdownPos.left,
                            width: dropdownPos.width,
                            zIndex: 9999,
                          }}
                          className="bg-popover border border-white/10 rounded-xl overflow-hidden shadow-xl"
                        >
                          {/* Limit dropdown to ~4 visible items; scrollable when more groups exist */}
                          <div className="max-h-36 overflow-y-auto">
                          {contactGroups.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-white/40">No groups available</p>
                          ) : (
                            contactGroups.map((group) => {
                              const checked = selected.includes(group.id);
                              return (
                                <div
                                  key={group.id}
                                  onClick={() => toggle(group.id)}
                                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-accent border-accent' : 'border-white/20'}`}>
                                    {checked && <Check className="w-3 h-3 text-accent-foreground stroke-[3px]" />}
                                  </div>
                                  <span className="text-sm text-white">{group.name}</span>
                                </div>
                              );
                            })
                          )}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
