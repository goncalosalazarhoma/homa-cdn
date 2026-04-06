const { del } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

module.exports.default = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const filesRaw = await redis.hgetall('homa:files');
    if (!filesRaw) return res.status(200).json({ deleted: 0 });

    const now = Date.now();
    const expired = Object.entries(filesRaw)
      .map(([url, v]) => ({ url, meta: typeof v === 'string' ? JSON.parse(v) : v }))
      .filter(({ meta }) => meta.expiresAt && meta.expiresAt < now);

    let deleted = 0;
    for (const { url } of expired) {
      try {
        await del(url);
        await redis.hdel('homa:files', url);
        deleted++;
      } catch (err) {
        console.error(`Failed to delete ${url}:`, err.message);
      }
    }

    return res.status(200).json({ deleted, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Cleanup error:', err);
    return res.status(500).json({ error: err.message });
  }
};
