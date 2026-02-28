import db from './index.ts';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'developer' | 'user';
  created_at: string;
}

export function upsertUser(email: string, name: string | null, avatar_url: string | null): User {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  
  if (existing) {
    db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE email = ?').run(name, avatar_url, email);
    return { ...existing, name, avatar_url };
  }

  const id = uuidv4();
  // First user is admin
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const role = count.count === 0 ? 'admin' : 'user';

  db.prepare('INSERT INTO users (id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?)').run(
    id, email, name, avatar_url, role
  );

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
}

export function getUserById(id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}
