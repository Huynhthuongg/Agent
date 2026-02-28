import db from './index.ts';
import { v4 as uuidv4 } from 'uuid';

export function logAudit(userId: string, action: string, resource: string, details: any = null) {
  db.prepare('INSERT INTO audit_logs (id, user_id, action, resource, details) VALUES (?, ?, ?, ?, ?)').run(
    uuidv4(),
    userId,
    action,
    resource,
    details ? JSON.stringify(details) : null
  );
}

export function getAuditLogs(limit: number = 50) {
  return db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
}
