import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { terminalAuditLog, users } from '@/db/schema';

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

export async function listTerminalAuditLog(workspaceId: string, limit = 100) {
  return db
    .select({
      id: terminalAuditLog.id,
      userId: terminalAuditLog.userId,
      userEmail: users.email,
      sessionId: terminalAuditLog.sessionId,
      command: terminalAuditLog.command,
      exitCode: terminalAuditLog.exitCode,
      executedAt: terminalAuditLog.executedAt,
    })
    .from(terminalAuditLog)
    .innerJoin(users, eq(terminalAuditLog.userId, users.id))
    .where(eq(terminalAuditLog.workspaceId, workspaceId))
    .orderBy(desc(terminalAuditLog.executedAt))
    .limit(limit);
}
