import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { getQR, getStatus, getLog } from './bot.js';
import { getFolderId, setFolderId, getFolderInfo, extractFolderId } from './drive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/status', async (req, res) => {
  const folderId = getFolderId();
  let folderName = null;

  if (folderId) {
    const info = await getFolderInfo(folderId).catch(() => null);
    folderName = info?.name || null;
  }

  res.json({
    connected: getStatus(),
    hasQR: !!getQR(),
    folderId,
    folderName,
    groupName: (process.env.WA_GROUP_NAME || '').trim(),
    log: getLog(),
  });
});

app.get('/api/qr', async (req, res) => {
  const qr = getQR();
  if (!qr) return res.json({ qr: null });
  const qrImage = await QRCode.toDataURL(qr);
  res.json({ qr: qrImage });
});

// Acepta URL completa o ID directo
app.post('/api/folder', async (req, res) => {
  const { folderUrl } = req.body;
  if (!folderUrl) return res.status(400).json({ error: 'folderUrl requerido' });

  const id = extractFolderId(folderUrl);
  if (!id) return res.status(400).json({ error: 'No se pudo extraer el ID de la URL' });

  const info = await getFolderInfo(id).catch(() => null);
  if (!info) return res.status(404).json({ error: 'Carpeta no encontrada o sin acceso. Verifica que tu cuenta tenga permiso.' });

  setFolderId(id);
  res.json({ ok: true, folderName: info.name, folderId: id });
});

export function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌐 Interfaz disponible en http://localhost:${PORT}`);
  });
}
