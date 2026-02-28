import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'super_ai.db');
const db = new Database(dbPath);

const schemaPath = path.resolve(process.cwd(), 'db/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

export default db;
