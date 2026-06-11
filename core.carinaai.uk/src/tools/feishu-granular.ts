import type { Tool } from '../types/index.js';

async function feishuToken(): Promise<string | null> {
  const appId = process.env.FEISHU_APP_ID ?? '';
  const appSecret = process.env.FEISHU_APP_SECRET ?? '';
  if (!appId || !appSecret) return null;

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await res.json() as { tenant_access_token?: string };
  return data.tenant_access_token ?? null;
}

export const feishuChatSendTool: Tool = {
  name: 'feishu-chat-send',
  dangerous: true,
  description: 'Send a text message to a Feishu/Lark chat.',
  parameters: {
    type: 'object',
    properties: {
      chat_id: { type: 'string' },
      text: { type: 'string' },
    },
    required: ['chat_id', 'text'],
  },
  requiresConfirmation: true,
  execute: async (params) => {
    const token = await feishuToken();
    if (!token) return { error: 'Set FEISHU_APP_ID and FEISHU_APP_SECRET' };

    const chatId = String(params.chat_id ?? '').trim();
    const text = String(params.text ?? '').trim();
    if (!chatId || !text) return { error: 'chat_id and text are required' };

    const res = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    });
    const data = await res.json();
    return { status: res.status, data };
  },
};

export const feishuUserLookupTool: Tool = {
  name: 'feishu-user-lookup',
  description: 'Look up a Feishu user by open_id or user_id.',
  parameters: {
    type: 'object',
    properties: {
      user_id: { type: 'string' },
      id_type: { type: 'string', enum: ['open_id', 'user_id', 'union_id'] },
    },
    required: ['user_id'],
  },
  execute: async (params) => {
    const token = await feishuToken();
    if (!token) return { error: 'Set FEISHU_APP_ID and FEISHU_APP_SECRET' };

    const userId = String(params.user_id ?? '').trim();
    const idType = String(params.id_type ?? 'open_id');
    const res = await fetch(
      `https://open.feishu.cn/open-apis/contact/v3/users/${userId}?user_id_type=${idType}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    return { status: res.status, data };
  },
};
