import { db } from '../src/lib/server/db.ts';
import { addDemoData } from '../src/lib/server/demo-data.ts';
try { process.loadEnvFile('.env.local'); } catch {}
const connection = await db('live');
try { console.log(JSON.stringify(await addDemoData(connection))); }
finally { connection.close(); }
