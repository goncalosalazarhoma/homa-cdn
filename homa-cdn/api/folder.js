import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.HOMA_CDN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, parent } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const parentPath = parent === 'root' || !parent ? '' : parent.replace('folder:', '');
  const path = parentPath ? `${parentPath}/${name}` : name;
  const id = `folder:${path}`;

  const folder = {
    id,
    name,
    path,
    parent: parent || 'root',
    createdAt: Date.now(),
  };

  await kv.hset('homa:folders', { [id]: JSON.stringify(folder) });
  return res.status(200).json(folder);
}
