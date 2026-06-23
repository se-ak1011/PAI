import { getSupabaseClient } from '@/template/core';

export interface Conversation {
  id: string;
  job_post_id: string;
  customer_id: string;
  contractor_id: string;
  created_at: string;
  last_message_at: string;
}

export interface ConversationSummary extends Conversation {
  job_title: string;
  other_name: string;       // the other participant's name (from this user's POV)
  last_message: string | null;
  unread: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** Find the conversation for a given job + contractor (returns null if none). */
export async function getConversation(
  jobPostId: string,
  contractorId: string,
): Promise<Conversation | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('job_post_id', jobPostId)
    .eq('contractor_id', contractorId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Conversation;
}

/**
 * Get-or-create the conversation for an accepted job. RLS only allows this when
 * an accepted application links the customer + contractor on this job.
 */
export async function ensureConversation(params: {
  jobPostId: string;
  customerId: string;
  contractorId: string;
}): Promise<{ conversation: Conversation | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const existing = await getConversation(params.jobPostId, params.contractorId);
  if (existing) return { conversation: existing, error: null };

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      job_post_id: params.jobPostId,
      customer_id: params.customerId,
      contractor_id: params.contractorId,
    })
    .select()
    .single();
  if (error) {
    // Unique-violation race: someone created it between our check and insert.
    if ((error as any).code === '23505') {
      const again = await getConversation(params.jobPostId, params.contractorId);
      if (again) return { conversation: again, error: null };
    }
    return { conversation: null, error: error.message };
  }
  return { conversation: data as Conversation, error: null };
}

/** List the signed-in user's conversations, newest activity first. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      job_post:job_post_id(title),
      customer:customer_id(username),
      contractor:contractor_id(username),
      messages(body, created_at, sender_id, read_at)
    `)
    .order('last_message_at', { ascending: false });
  if (error || !data) return [];

  return (data as any[]).map((c) => {
    const msgs = (c.messages || []).slice().sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const last = msgs[msgs.length - 1];
    const isCustomer = c.customer_id === userId;
    const unread = msgs.filter((m: any) => m.sender_id !== userId && !m.read_at).length;
    return {
      id: c.id,
      job_post_id: c.job_post_id,
      customer_id: c.customer_id,
      contractor_id: c.contractor_id,
      created_at: c.created_at,
      last_message_at: c.last_message_at,
      job_title: c.job_post?.title || 'Job',
      other_name: (isCustomer ? c.contractor?.username : c.customer?.username) || 'User',
      last_message: last?.body ?? null,
      unread,
    };
  });
}

/** Load all messages in a conversation, oldest first. */
export async function listMessages(conversationId: string): Promise<Message[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as Message[];
}

/** Send a message. Returns the created row or an error. */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<{ message: Message | null; error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { message: null, error: 'Message is empty.' };
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select()
    .single();
  if (error) return { message: null, error: error.message };
  return { message: data as Message, error: null };
}

/** Mark the other party's unread messages in this conversation as read. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
}
