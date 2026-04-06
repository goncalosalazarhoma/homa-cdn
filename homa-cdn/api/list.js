import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.HOMA_CDN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [filesRaw, foldersRaw] = await Promise.all([
      kv.hgetall('homa:files'),
      kv.hgetall('homa:folders'),
    ]);

    const files = filesRaw
      ? Object.values(filesRaw).map((v) => (typeof v === 'string' ? JSON.parse(v) : v))
      : [];

    const folders = foldersRaw
      ? Object.values(foldersRaw).map((v) => (typeof v === 'string' ? JSON.parse(v) : v))
      : [];

    const now = Date.now();
    const activeFiles = files.filter((f) => !f.expiresAt || f.expiresAt > now);

    return res.status(200).json({ files: activeFiles, folders });
  } catch (err) {
    console.error('List error:', err);
    return res.status(500).json({ error: err.message });
  }
}
