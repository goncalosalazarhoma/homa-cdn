import { del } from '@vercel/blob';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const filesRaw = await kv.hgetall('homa:files');
    if (!filesRaw) return res.status(200).json({ deleted: 0, message: 'No files found' });

    const now = Date.now();
    const expired = Object.entries(filesRaw)
      .map(([url, v]) => ({ url, meta: typeof v === 'string' ? JSON.parse(v) : v }))
      .filter(({ meta }) => meta.expiresAt && meta.expiresAt < now);

    let deleted = 0;
    for (const { url, meta } of expired) {
      try {
        await del(url);
        await kv.hdel('homa:files', url);
        deleted++;
        console.log(`Deleted expired file: ${meta.pathname} (expired ${new Date(meta.expiresAt).toISOString()})`);
      } catch (err) {
        console.error(`Failed to delete ${url}:`, err.message);
      }
    }

    return res.status(200).json({
      deleted,
      checked: expired.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    return res.status(500).json({ error: err.message });
  }
}
