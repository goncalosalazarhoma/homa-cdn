import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    const fields = {};
    let fileData = null;
    let filename = null;
    let mimetype = null;
    const chunks = [];

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, file, info) => {
      filename = info.filename;
      mimetype = info.mimeType;
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        fileData = Buffer.concat(chunks);
      });
    });

    bb.on('close', () => resolve({ fields, fileData, filename, mimetype }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.HOMA_CDN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

    await kv.hset('homa:files', { [blob.url]: JSON.stringify(meta) });

    if (folder && folder !== 'root') {
      const parts = folder.split('/');
      let accumulated = '';
      for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        const parentPath = accumulated.includes('/') ? accumulated.split('/').slice(0, -1).join('/') : 'root';
        const folderKey = `folder:${accumulated}`;
        const existing = await kv.hget('homa:folders', folderKey);
        if (!existing) {
          await kv.hset('homa:folders', {
            [folderKey]: JSON.stringify({
              id: folderKey,
              name: part,
              path: accumulated,
              parent: parentPath === '' ? 'root' : `folder:${parentPath}`,
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
}
