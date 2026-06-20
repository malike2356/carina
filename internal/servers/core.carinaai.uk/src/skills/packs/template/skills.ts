import type { PackSkillInput } from '../../pack-types.js';

export const helloWorldTemplateSkills: PackSkillInput[] = [
  {
    name: 'domain-greeting',
    description: 'Respond with a friendly domain-specific greeting when the user says hello',
    trigger: ['hello', 'hi', 'greet', 'introduction'],
    steps: `1. Greet the user warmly in one or two sentences.
2. Mention you are running with the hello-world domain pack active.
3. Offer to help with a simple demo task (list files, explain a concept, or run a safe command).
4. Do not invent compliance rules or regulated data; this is a demo pack only.`,
    toolsUsed: ['file-read'],
  },
];
