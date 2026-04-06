const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

module.exports.default = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['authorization'] !== `Bearer ${process.env.HOMA_CDN_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });

  const { name, parent } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const parentPath = !parent || parent === 'root' ? '' : parent.replace('folder:', '');
  const path = parentPath ? `${parentPath}/${name}` : name;
  const id = `folder:${path}`;

  const folder = { id, name, path, parent: parent || 'root', createdAt: Date.now() };
  await redis.hset('homa:folders', { [id]: JSON.stringify(folder) });
  return res.status(200).json(folder);
};
