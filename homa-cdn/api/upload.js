const { put } = require('@vercel/blob');
const { Redis } = require('@upstash/redis');
const Busboy = require('busboy');

const redis = Redis.fromEnv();

module.exports.config = { api: { bodyParser: false } };

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    const fields = {};
    let filename = null, mimetype = null;
    const chunks = [];
    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (name, file, info) => {
      filename = info.filename;
      mimetype = info.mimeType;
      file.on('data', (d) => chunks.push(d));
    });
    bb.on('close', () => resolve({ fields, fileData: Buffer.concat(chunks), filename, mimetype }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

module.exports.default = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['authorization'] !== `Bearer ${process.env.HOMA_CDN_SECRET}`)
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { fields, fileData, filename, mimetype } = await parseMultipart(req);
    const folder = fields.folder ? fields.folder.replace(/^\/|\/$/g, '') : '';
    const expiresAt = fields.expiresAt ? parseInt(fields.expiresAt) : null;
    const blobPath = folder ? `${folder}/${filename}` : filename;

    const blob = await put(blobPath, fileData, {
      access: 'public',
      contentType: mimetype,
      addRandomSuffix: false,
    });

    const meta = {
      url: blob.url,
      pathname: blobPath,
      folder: folder || 'root',
      filename,
      size: fileData.length,
      contentType: mimetype,
      uploadedAt: Date.now(),
      expiresAt,
    };

    await redis.hset('homa:files', { [blob.url]: JSON.stringify(meta) });

    if (folder) {
      const parts = folder.split('/');
      let accumulated = '';
      for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        const parentRaw = accumulated.includes('/')
          ? accumulated.split('/').slice(0, -1).join('/')
          : 'root';
        const folderKey = `folder:${accumulated}`;
        const existing = await redis.hget('homa:folders', folderKey);
        if (!existing) {
          await redis.hset('homa:folders', {
            [folderKey]: JSON.stringify({
              id: folderKey,
              name: part,
              path: accumulated,
              parent: parentRaw === '' ? 'root' : `folder:${parentRaw}`,
              createdAt: Date.now(),
            }),
          });
        }
      }
    }

    return res.status(200).json(meta);
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
};
