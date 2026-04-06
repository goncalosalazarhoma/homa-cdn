const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();

module.exports.default = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['authorization'] !== `Bearer ${process.env.HOMA_CDN_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [filesRaw, foldersRaw] = await Promise.all([
      redis.hgetall('homa:files'),
      redis.hgetall('homa:folders'),
    ]);
    const parse = (raw) => raw ? Object.values(raw).map(v => typeof v === 'string' ? JSON.parse(v) : v) : [];
    const files = parse(filesRaw).filter(f => !f.expiresAt || f.expiresAt > Date.now());
    return res.status(200).json({ files, folders: parse(foldersRaw) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
