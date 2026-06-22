'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Send, 
  Users, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Search,
  Check,
  MessageSquare
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  group_id: string | null;
}

interface ContactGroup {
  id: string;
  name: string;
}

interface SmsMessage {
  id: string;
  created_at: string;
  message_content: string;
  status: string;
  failure_reason: string | null;
  contacts: {
    name: string;
    phone_number: string;
  };
  android_devices: {
    device_name: string;
  } | null;
}

export default function BulkSmsPage() {
  const supabase = useSupabase();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshingLog, setRefreshingLog] = useState(false);

  // Form State
  const [sendToType, setSendToType] = useState<'all_contacts' | 'group' | 'multiple_contacts'>('all_contacts');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Fetch initial data
  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Contacts
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('id, name, phone_number, group_id')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      setContacts(contactsData || []);

      // 2. Fetch Contact Groups
      const { data: groupsData } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      setGroups(groupsData || []);

      // 3. Fetch Recent Messages Log
      await fetchMessagesLog();
    } catch (err) {
      console.error('Error fetching Bulk SMS page data:', err);
      toast.error('Failed to load audience data');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchMessagesLog = async () => {
    setRefreshingLog(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sms_messages')
        .select(`
          id,
          created_at,
          message_content,
          status,
          failure_reason,
          contacts!inner (name, phone_number, user_id),
          android_devices (device_name)
        `)
        .eq('contacts.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setMessages((data as any) || []);
    } catch (err: any) {
      console.error('Error loading broadcast history:', err);
      toast.error('Failed to load message history');
    } finally {
      setRefreshingLog(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  // Handle contact search filtering for manual select list
  const filteredContactsList = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    c.phone_number.includes(contactSearchQuery)
  );

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageContent.trim()) {
      toast.error('Please enter a message content');
      return;
    }

    if (sendToType === 'group' && !selectedGroupId) {
      toast.error('Please select a contact group');
      return;
    }

    if (sendToType === 'multiple_contacts' && selectedContactIds.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sendToType,
          groupId: sendToType === 'group' ? selectedGroupId : undefined,
          contactIds: sendToType === 'multiple_contacts' ? selectedContactIds : undefined,
          messageContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger SMS blast');
      }

      toast.success(data.message || 'SMS blast started immediately!');
      setMessageContent('');
      setSelectedContactIds([]);
      
      // Refresh log
      await fetchMessagesLog();
    } catch (error: any) {
      toast.error('Send failed', { description: error.message });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
      case 'read':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-400/10 text-green-400 border border-green-400/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sent</span>
          </span>
        );
      case 'sending':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 animate-pulse">
            <Send className="w-3 h-3" />
            <span>Sending</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-400/10 text-red-400 border border-red-400/20">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
    }
  };

  // SMS character count logic
  const charLimit = 160;
  const charsUsed = messageContent.length;
  const smsCount = Math.ceil(charsUsed / charLimit) || 1;

  if (loadingData) {
    return (
      <div className="p-20 text-center text-text-muted animate-pulse">Loading setup data...</div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white text-glow">Bulk SMS Blast</h1>
        <p className="text-text-muted text-sm mt-1">Compose and send instant broadcasts directly through your Android devices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left compose panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 border-white/5 bg-white/2">
            <h2 className="text-lg font-semibold text-white mb-4">Compose Blast</h2>
            
            <form onSubmit={handleSend} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white">Target Audience</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendToType('all_contacts')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      sendToType === 'all_contacts'
                        ? 'bg-accent text-accent-foreground border-accent shadow-[0_0_10px_rgba(66,245,230,0.2)]'
                        : 'bg-black/20 border-white/10 text-text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All Contacts ({contacts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendToType('group')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      sendToType === 'group'
                        ? 'bg-accent text-accent-foreground border-accent shadow-[0_0_10px_rgba(66,245,230,0.2)]'
                        : 'bg-black/20 border-white/10 text-text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendToType('multiple_contacts')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      sendToType === 'multiple_contacts'
                        ? 'bg-accent text-accent-foreground border-accent shadow-[0_0_10px_rgba(66,245,230,0.2)]'
                        : 'bg-black/20 border-white/10 text-text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Select List
                  </button>
                </div>
              </div>

              {/* Group selection input */}
              {sendToType === 'group' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label htmlFor="groupSelect" className="text-white">Select Contact Group</Label>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger id="groupSelect" className="bg-black/20 border-white/10 text-white rounded-xl">
                      <SelectValue placeholder="Choose a group..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-white/10 text-white rounded-xl">
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id} className="rounded-lg">
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Specific contacts multi-select list */}
              {sendToType === 'multiple_contacts' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex justify-between items-center">
                    <Label className="text-white">Select Recipients ({selectedContactIds.length})</Label>
                    {selectedContactIds.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setSelectedContactIds([])}
                        className="text-[10px] text-accent hover:underline font-bold uppercase tracking-wider"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                    <Input
                      placeholder="Search contacts..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="pl-9 bg-black/20 border-white/10 text-xs rounded-xl focus:border-accent/50"
                    />
                  </div>
                  
                  <div className="max-h-[160px] overflow-y-auto border border-white/10 rounded-xl bg-black/10 divide-y divide-white/5 pr-1">
                    {filteredContactsList.length > 0 ? (
                      filteredContactsList.map((contact) => {
                        const isSelected = selectedContactIds.includes(contact.id);
                        return (
                          <div 
                            key={contact.id}
                            onClick={() => toggleContactSelection(contact.id)}
                            className="flex items-center justify-between p-2 px-3 hover:bg-white/5 cursor-pointer transition-colors group"
                          >
                            <div>
                              <p className="text-xs font-semibold text-white group-hover:text-accent transition-colors">{contact.name}</p>
                              <p className="text-[10px] text-text-muted font-mono">{contact.phone_number}</p>
                            </div>
                            <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                              isSelected 
                                ? 'bg-accent border-accent text-accent-foreground' 
                                : 'border-white/20 group-hover:border-accent/50'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3px]" />}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="p-4 text-center text-xs text-text-muted">No contacts found</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="messageBox" className="text-white">SMS Message</Label>
                  <span className="text-[10px] text-text-muted font-mono">
                    {charsUsed} chars / {smsCount} SMS
                  </span>
                </div>
                <Textarea
                  id="messageBox"
                  placeholder="Enter message content here..."
                  rows={5}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  className="bg-black/20 border-white/10 text-sm rounded-xl focus:border-accent/50 placeholder:text-text-muted/65"
                  required
                />
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_rgba(66,245,230,0.3)] h-11 text-sm font-bold rounded-xl"
                  disabled={sending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? 'Sending Blast...' : 'Send SMS Blast'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right log panel */}
        <div className="lg:col-span-3">
          <div className="glass-card border-white/5 bg-white/2 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
              <div>
                <h2 className="text-lg font-semibold text-white">Broadcast Log</h2>
                <p className="text-xs text-text-muted">Real-time individual message sending status</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 hover:bg-white/5 text-white size-9 p-0"
                onClick={fetchMessagesLog}
                disabled={refreshingLog}
              >
                <RefreshCw className={`w-4 h-4 ${refreshingLog ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex-grow overflow-x-auto">
              {messages.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/5">
                      <TableHead>Recipient</TableHead>
                      <TableHead>Message Preview</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-white/[0.02]">
                    {messages.map((msg) => (
                      <TableRow key={msg.id} className="hover:bg-white/5 group transition-colors border-b border-white/[0.02]">
                        <TableCell className="py-3">
                          <p className="font-semibold text-white group-hover:text-accent transition-colors">{msg.contacts?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-text-muted font-mono">{msg.contacts?.phone_number}</p>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-text-muted italic group-hover:text-white/80 transition-colors">
                          &quot;{msg.message_content}&quot;
                        </TableCell>
                        <TableCell className="text-xs text-text-muted group-hover:text-white/80 transition-colors">
                          {msg.android_devices?.device_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(msg.status)}
                          {msg.status === 'failed' && msg.failure_reason && (
                            <p className="text-[9px] text-red-400 mt-1 max-w-[120px] truncate" title={msg.failure_reason}>
                              {msg.failure_reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-text-muted text-[10px] whitespace-nowrap group-hover:text-white/80 transition-colors">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-20 text-center flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center mb-4 border border-accent/10">
                    <MessageSquare className="w-8 h-8 text-accent/40" />
                  </div>
                  <h3 className="text-base font-bold text-white">No messages sent yet</h3>
                  <p className="text-text-muted max-w-xs mx-auto mt-1 text-xs">
                    Compose a blast on the left to start sending bulk messages.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
