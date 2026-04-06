const { del } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

module.exports.default = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['authorization'] !== `Bearer ${process.env.HOMA_CDN_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  try {
    await del(url);
    await redis.hdel('homa:files', url);
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
};
