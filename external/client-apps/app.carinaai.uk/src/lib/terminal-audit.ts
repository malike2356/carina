import { db } from '@/db';
import { terminalAuditLog } from '@/db/schema';

export async function logTerminalCommand(input: {
  workspaceId: string;
  userId: string;
  sessionId: string;
  command: string;
  exitCode: number | null;
}): Promise<void> {
  await db.insert(terminalAuditLog).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    sessionId: input.sessionId,
    command: input.command,
    exitCode: input.exitCode,
  });
}
