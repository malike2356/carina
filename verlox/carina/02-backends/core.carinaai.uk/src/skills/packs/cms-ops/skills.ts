import type { PackSkillInput } from '../../pack-types.js';

export const cmsOpsSkills: PackSkillInput[] = [
  {
    name: 'wordpress-author',
    description:
      'Draft, tag, SEO-optimize, and schedule WordPress posts collaboratively via the WordPress MCP server',
    trigger: [
      'wordpress post',
      'wp draft',
      'wp publish',
      'write blog post',
      'schedule post',
      'wordpress seo',
      'cms publish',
    ],
    steps: `1. DRAFT: Ask for topic, target audience, tone, and desired length. Generate the post body as structured HTML (headings, lists, paragraphs). Present the full draft in chat and wait for review before writing anything to WordPress.
2. TAG AND CATEGORIZE: Suggest relevant tags and categories based on the content. Use the wordpress MCP server to list existing categories and tags; prefer reusing them over creating duplicates. Confirm selections with the user before applying.
3. SEO: After the draft is approved, suggest an SEO-friendly title, a meta description (<= 160 chars), a URL slug, and a focus keyphrase. Offer notes on heading structure and keyword density. Apply changes only after explicit user confirmation.
4. PUBLISH OR SCHEDULE: Ask whether to publish immediately or on a specific date/time. Show a final summary (title, status, scheduled date, categories, tags) and require explicit confirmation before calling any publish or schedule MCP action.
5. GUARDRAILS: Never publish or schedule without confirmation. Never invent analytics, traffic data, or external SEO metrics. Before updating a post, fetch its current version to avoid overwriting recent edits. On any MCP failure, report the error clearly and offer a retry. Log every write action back to the user with the post ID returned by WordPress.`,
    toolsUsed: ['wordpress'],
  },
];
