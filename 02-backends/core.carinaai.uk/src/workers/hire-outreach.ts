import { llm } from '../brain/llm.js';
import { runWebSearch } from '../tools/web-search-provider.js';
import type { WorkspaceContact } from '../email/workspace-contact.js';
import { firstName } from '../email/workspace-contact.js';
import type { Worker } from '../types/index.js';

export type HireOutreachContent = {
  subject: string;
  emailBody: string;
  whatsappBody: string;
};

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'live.com',
  'proton.me',
  'protonmail.com',
]);

function companyHintFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null;
  const label = domain.split('.')[0] ?? domain;
  return label.replace(/[-_]/g, ' ');
}

async function researchOwnerContext(input: {
  ownerName: string;
  ownerEmail: string;
  workFunction: string;
}): Promise<string> {
  const hints: string[] = [];
  const company = companyHintFromEmail(input.ownerEmail);
  if (company) hints.push(`Company/domain hint: ${company}`);
  if (input.workFunction.trim()) hints.push(`Work function: ${input.workFunction.trim()}`);

  const queryParts = [input.ownerName.trim(), company].filter(Boolean);
  if (queryParts.length === 0) return hints.join('\n');

  try {
    const results = await runWebSearch(queryParts.join(' '), 3);
    const snippets = results
      .slice(0, 3)
      .map((row) => `- ${row.title}: ${row.description}`)
      .join('\n');
    if (snippets) hints.push(`Public web snippets:\n${snippets}`);
  } catch {
    // Search is optional; outreach still sends without it.
  }

  return hints.join('\n\n');
}

export async function generateHireOutreachContent(
  worker: Worker,
  contact: WorkspaceContact | null,
): Promise<HireOutreachContent> {
  const ownerName = contact?.preferredName.trim() || contact?.ownerName.trim() || 'there';
  const ownerFirst = firstName(ownerName, contact?.ownerEmail);
  const ownerEmail = contact?.ownerEmail ?? '';
  const research = contact
    ? await researchOwnerContext({
        ownerName: contact.ownerName || ownerName,
        ownerEmail,
        workFunction: contact.workFunction,
      })
    : '';

  const rawRoleLine = worker.roleDescription.split(/[.!?]/)[0]?.trim() || worker.roleDescription;
  // If the role description starts with a verb ("Handles...", "Responds..."),
  // prefix with "AI assistant that" so the fallback template reads naturally.
  const startsWithVerb = /^[A-Z][a-z]+s\b/.test(rawRoleLine);
  const roleLine = startsWithVerb
    ? `AI assistant that ${rawRoleLine[0]!.toLowerCase()}${rawRoleLine.slice(1)}`
    : rawRoleLine;
  const prompt = `Write a first hire welcome message from AI worker "${worker.name}" to their new manager.

Manager first name: ${ownerFirst}
Manager full name: ${ownerName}
Manager email: ${ownerEmail || 'unknown'}
Worker role (one line): ${roleLine}
Manager preferences: ${contact?.personalPreferences?.trim() || 'none provided'}

Background research (may be incomplete; only use facts that appear here, otherwise ask politely):
${research || 'No public background found. Keep the intro warm and ask what to remember about them.'}

Requirements:
- First person from ${worker.name}. Warm, human, professional. No marketing fluff.
- Email body: 3 to 5 short paragraphs. Include a section "A little about what I picked up" only if research exists; otherwise invite them to tell you about their work.
- Mention 2 practical ways you can help in the role.
- End with a casual sign-off from ${worker.name} only (no HTML).
- WhatsApp body: under 320 characters, friendly ping referencing the email.
- Subject line: Hey, I'm ${worker.name}!

Return strict JSON:
{"subject":"...","emailBody":"...","whatsappBody":"..."}`;

  try {
    const response = await llm.chatCheap([
      { role: 'user', content: prompt, timestamp: new Date() },
    ]);
    const raw = response.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<HireOutreachContent>;
      if (parsed.emailBody && parsed.whatsappBody) {
        return {
          subject: parsed.subject?.trim() || `Hey, I'm ${worker.name}!`,
          emailBody: parsed.emailBody.trim(),
          whatsappBody: parsed.whatsappBody.trim(),
        };
      }
    }
  } catch (err) {
    console.warn('[hire-outreach] LLM failed, using fallback template:', err);
  }

  return {
    subject: `Hey, I'm ${worker.name}!`,
    emailBody: [
      `Hey ${ownerFirst},`,
      '',
      `I'm ${worker.name}, your ${roleLine.toLowerCase()}. Send me what you need and I will get to work.`,
      '',
      'Send me what you are working on and I will help you move it forward. If I got anything wrong about your background, tell me once and I will remember it.',
      '',
      `Talk soon,\n${worker.name}`,
    ].join('\n'),
    whatsappBody: `Hey ${ownerFirst}! It's ${worker.name}; just saying hello here too. Check your email when you can; I'm ready when you are.`,
  };
}
