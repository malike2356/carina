import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CARINA_HOME } from '../../config/paths.js';

export type LocalSession = {
  id: string;
  source: string;
  externalUserId: string;
  updatedAt: string;
};

export class LocalSessionManager {
  constructor(private readonly sessionsDir = path.join(CARINA_HOME, 'sessions')) {}

  private sessionPath(id: string): string {
    return path.join(this.sessionsDir, `${id}.json`);
  }

  async create(source: string, externalUserId: string): Promise<LocalSession> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    const session: LocalSession = {
      id: uuidv4(),
      source,
      externalUserId,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), { mode: 0o600 });
    return session;
  }

  async read(id: string): Promise<LocalSession | null> {
    try {
      const raw = await fs.readFile(this.sessionPath(id), 'utf-8');
      return JSON.parse(raw) as LocalSession;
    } catch {
      return null;
    }
  }

  async touch(id: string): Promise<void> {
    const session = await this.read(id);
    if (!session) return;
    session.updatedAt = new Date().toISOString();
    await fs.writeFile(this.sessionPath(id), JSON.stringify(session, null, 2), { mode: 0o600 });
  }
}
