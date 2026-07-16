import { readChannelCredentials, getWorkerChannelByWorkerAndChannel } from '../../channels/channel-store.js';

const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';

export async function publishLinkedInPost(input: {
  workerId: string;
  text: string;
}): Promise<{ postUrn?: string }> {
  const row = await getWorkerChannelByWorkerAndChannel(input.workerId, 'linkedin');
  if (!row) {
    throw new Error('LinkedIn channel is not connected for this worker');
  }
  const credentials = readChannelCredentials(row);
  const accessToken = credentials.access_token?.trim();
  const memberId = credentials.member_id?.trim();
  if (!accessToken || !memberId) {
    throw new Error('LinkedIn credentials missing access_token or member_id');
  }

  const author = memberId.startsWith('urn:') ? memberId : `urn:li:person:${memberId}`;
  const body = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: input.text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const response = await fetch(LINKEDIN_UGC_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    throw new Error(`LinkedIn post publish failed: ${error || response.status}`);
  }

  const postUrn = response.headers.get('x-restli-id') ?? undefined;
  return { postUrn };
}
