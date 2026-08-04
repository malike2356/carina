import type { SlashCommand } from './registry.js';
import { newCommand as aivaNewCommand } from './memory-commands.js';

// Re-export the fixed /new that clears real episodic sessions.
export const newCommand: SlashCommand = aivaNewCommand;
