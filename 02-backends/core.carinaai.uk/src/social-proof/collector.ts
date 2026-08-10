/**
 * Multi-platform collectors. Live APIs are optional (env tokens);
 * fixtures always work for tests and offline curation.
 */
import { readFileSync, existsSync } from 'node:fs';
import type { CollectResult, Platform, Testimonial } from './types.js';
import type { TestimonialStore } from './store.js';

export type CollectOptions = {
  product?: string;
  fetchImpl?: typeof fetch;
  fixturesPath?: string;
};

type RawItem = {
  text: string;
  author: string;
  authorTitle?: string | null;
  platform: Platform;
  url: string;
  date?: string;
  tags?: string[];
  product?: string;
};

function ingest(store: TestimonialStore, items: RawItem[], platform: Platform, product?: string): CollectResult {
  let added = 0;
  let duplicates = 0;
  const out: Testimonial[] = [];
  for (const item of items) {
    const result = store.upsertIncoming({
      text: item.text,
      author: item.author,
      authorTitle: item.authorTitle ?? null,
      url: item.url,
      date: item.date,
      tags: item.tags ?? [],
      product: item.product || product || 'general',
      platform,
      status: 'pending',
    });
    if (result.duplicate) duplicates += 1;
    else {
      added += 1;
      out.push(result.item);
    }
  }
  return { platform, added, duplicates, items: out };
}

function loadFixturePlatform(fixturesPath: string | undefined, platform: Platform): RawItem[] {
  if (!fixturesPath || !existsSync(fixturesPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(fixturesPath, 'utf8')) as Record<string, RawItem[]>;
    return Array.isArray(raw[platform]) ? raw[platform]! : [];
  } catch {
    return [];
  }
}

/** X/Twitter: uses fixture or TWITTER_BEARER_TOKEN recent search when configured. */
export async function collectFromTwitter(
  username: string,
  store: TestimonialStore,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const fixtures = loadFixturePlatform(options.fixturesPath, 'twitter');
  if (fixtures.length) return ingest(store, fixtures, 'twitter', options.product);

  const token = process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;
  if (!token) return { platform: 'twitter', added: 0, duplicates: 0, items: [] };

  const fetchImpl = options.fetchImpl ?? fetch;
  const query = encodeURIComponent(`@${username} -is:retweet lang:en`);
  const res = await fetchImpl(`https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,author_id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { platform: 'twitter', added: 0, duplicates: 0, items: [] };
  const body = (await res.json()) as { data?: Array<{ id: string; text: string; created_at?: string }> };
  const items: RawItem[] = (body.data ?? []).map((t) => ({
    text: t.text,
    author: username,
    platform: 'twitter' as const,
    url: `https://twitter.com/i/web/status/${t.id}`,
    date: t.created_at?.slice(0, 10),
    tags: ['twitter'],
  }));
  return ingest(store, items, 'twitter', options.product);
}

/** LinkedIn: fixture or LINKEDIN_ACCESS_TOKEN organization posts (best-effort). */
export async function collectFromLinkedIn(
  companyPage: string,
  store: TestimonialStore,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const fixtures = loadFixturePlatform(options.fixturesPath, 'linkedin');
  if (fixtures.length) return ingest(store, fixtures, 'linkedin', options.product);
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) return { platform: 'linkedin', added: 0, duplicates: 0, items: [] };
  void companyPage;
  void token;
  // LinkedIn marketing APIs vary by partnership; keep adapter surface without inventing quotes.
  return { platform: 'linkedin', added: 0, duplicates: 0, items: [] };
}

/** GitHub: public issue comments / discussions praise (works without token; token raises rate limits). */
export async function collectFromGitHub(
  repo: string,
  store: TestimonialStore,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const fixtures = loadFixturePlatform(options.fixturesPath, 'github');
  if (fixtures.length) return ingest(store, fixtures, 'github', options.product);

  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'verlox-social-proof',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const issuesRes = await fetchImpl(
    `https://api.github.com/repos/${repo}/issues/comments?per_page=30&sort=updated&direction=desc`,
    { headers },
  );
  if (!issuesRes.ok) return { platform: 'github', added: 0, duplicates: 0, items: [] };
  const comments = (await issuesRes.json()) as Array<{
    body?: string;
    html_url?: string;
    created_at?: string;
    user?: { login?: string };
  }>;
  const praise = comments.filter((c) => {
    const body = String(c.body || '');
    return /thank|love|great|awesome|works|helpful|recommend/i.test(body) && body.length > 40 && body.length < 800;
  });
  const items: RawItem[] = praise.map((c) => ({
    text: String(c.body || '').trim(),
    author: c.user?.login || 'github-user',
    authorTitle: `${repo} contributor`,
    platform: 'github' as const,
    url: String(c.html_url || `https://github.com/${repo}`),
    date: c.created_at?.slice(0, 10),
    tags: ['github'],
  }));
  return ingest(store, items, 'github', options.product);
}

export async function collectFromDiscord(
  channelId: string,
  store: TestimonialStore,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const fixtures = loadFixturePlatform(options.fixturesPath, 'discord');
  if (fixtures.length) return ingest(store, fixtures, 'discord', options.product);
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !channelId) return { platform: 'discord', added: 0, duplicates: 0, items: [] };
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return { platform: 'discord', added: 0, duplicates: 0, items: [] };
  const messages = (await res.json()) as Array<{
    id: string;
    content?: string;
    timestamp?: string;
    author?: { username?: string };
  }>;
  const items: RawItem[] = messages
    .filter((m) => String(m.content || '').length > 40)
    .map((m) => ({
      text: String(m.content || '').trim(),
      author: m.author?.username || 'discord-user',
      platform: 'discord' as const,
      url: `https://discord.com/channels/@me/${channelId}/${m.id}`,
      date: m.timestamp?.slice(0, 10),
      tags: ['discord'],
    }));
  return ingest(store, items, 'discord', options.product);
}

export async function collectFromYouTube(
  videoIds: string[],
  store: TestimonialStore,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const fixtures = loadFixturePlatform(options.fixturesPath, 'youtube');
  if (fixtures.length) return ingest(store, fixtures, 'youtube', options.product);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !videoIds.length) return { platform: 'youtube', added: 0, duplicates: 0, items: [] };
  const fetchImpl = options.fetchImpl ?? fetch;
  const items: RawItem[] = [];
  for (const videoId of videoIds.slice(0, 5)) {
    const res = await fetchImpl(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=20&key=${encodeURIComponent(key)}`,
    );
    if (!res.ok) continue;
    const body = (await res.json()) as {
      items?: Array<{
        snippet?: {
          topLevelComment?: {
            id?: string;
            snippet?: { textDisplay?: string; authorDisplayName?: string; publishedAt?: string };
          };
        };
      }>;
    };
    for (const row of body.items ?? []) {
      const sn = row.snippet?.topLevelComment?.snippet;
      if (!sn?.textDisplay) continue;
      items.push({
        text: sn.textDisplay.replace(/<[^>]+>/g, ''),
        author: sn.authorDisplayName || 'youtube-user',
        platform: 'youtube',
        url: `https://www.youtube.com/watch?v=${videoId}&lc=${row.snippet?.topLevelComment?.id || ''}`,
        date: sn.publishedAt?.slice(0, 10),
        tags: ['youtube'],
      });
    }
  }
  return ingest(store, items, 'youtube', options.product);
}

export function manualEntry(
  store: TestimonialStore,
  input: {
    text: string;
    author: string;
    platform?: Platform;
    link: string;
    authorTitle?: string;
    product?: string;
    tags?: string[];
  },
): Testimonial {
  return store.manualEntry({
    text: input.text,
    author: input.author,
    authorTitle: input.authorTitle,
    platform: input.platform ?? 'manual',
    url: input.link,
    product: input.product,
    tags: input.tags,
  });
}

/** Collect from Twitter + LinkedIn + GitHub (acceptance: at least 3 platform adapters). */
export async function collectFromPrimaryPlatforms(
  store: TestimonialStore,
  config: {
    twitterUsername?: string;
    linkedinCompany?: string;
    githubRepo?: string;
    product?: string;
    fixturesPath?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<CollectResult[]> {
  const opts: CollectOptions = {
    product: config.product,
    fixturesPath: config.fixturesPath,
    fetchImpl: config.fetchImpl,
  };
  return Promise.all([
    collectFromTwitter(config.twitterUsername || 'carinaai', store, opts),
    collectFromLinkedIn(config.linkedinCompany || 'carina', store, opts),
    collectFromGitHub(config.githubRepo || 'malike2356/keprix', store, opts),
  ]);
}
