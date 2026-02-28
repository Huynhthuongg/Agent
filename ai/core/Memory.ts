import db from '../../db/index.ts';
import { v4 as uuidv4 } from 'uuid';

export class MemorySystem {
  private shortTermMemory: Map<string, any[]> = new Map();

  constructor() {}

  public addShortTerm(sessionId: string, data: any) {
    if (!this.shortTermMemory.has(sessionId)) {
      this.shortTermMemory.set(sessionId, []);
    }
    this.shortTermMemory.get(sessionId)?.push(data);
  }

  public getShortTerm(sessionId: string): any[] {
    return this.shortTermMemory.get(sessionId) || [];
  }

  public addLongTerm(agentId: string, context: string, data: any) {
    db.prepare('INSERT INTO memory_long_term (id, agent_id, context, data) VALUES (?, ?, ?, ?)').run(
      uuidv4(),
      agentId,
      context,
      JSON.stringify(data)
    );
  }

  public getLongTerm(agentId: string, context: string): any[] {
    const rows = db.prepare('SELECT * FROM memory_long_term WHERE agent_id = ? AND context = ?').all(agentId, context);
    return rows.map((r: any) => ({ ...r, data: JSON.parse(r.data) }));
  }

  public async addVector(text: string, metadata: any) {
    console.log(`[Vector DB] Storing text: ${text.substring(0, 50)}...`);
  }

  public async searchVector(query: string, topK: number = 5): Promise<any[]> {
    console.log(`[Vector DB] Searching for: ${query}`);
    return [];
  }
}
