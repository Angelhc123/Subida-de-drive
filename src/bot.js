import baileys from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason, fetchLatestBaileysVersion } = baileys;
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { uploadToDrive } from './drive.js';

const logger = pino({ level: 'silent' });

let sock = null;
let qrCode = null;
let isConnected = false;
let uploadLog = [];

export function getQR() { return qrCode; }
export function getStatus() { return isConnected; }
export function getLog() { return uploadLog.slice(-20); }

function addLog(entry) {
  uploadLog.push({ ...entry, time: new Date().toISOString() });
  if (uploadLog.length > 100) uploadLog.shift();
}

function getMimeType(msgType) {
  const map = {
    imageMessage: 'image/jpeg',
    videoMessage: 'video/mp4',
    audioMessage: 'audio/ogg',
    documentMessage: 'application/octet-stream',
    stickerMessage: 'image/webp',
  };
  return map[msgType] || 'application/octet-stream';
}

function getExtension(msgType, msg) {
  if (msgType === 'documentMessage') {
    return msg.documentMessage?.fileName?.split('.').pop() || 'bin';
  }
  const map = {
    imageMessage: 'jpg',
    videoMessage: 'mp4',
    audioMessage: 'ogg',
    stickerMessage: 'webp',
  };
  return map[msgType] || 'bin';
}

export async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ['WspDriveBot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrCode = qr;
      isConnected = false;
      console.log('📱 Escanea el QR desde la interfaz web en /qr');
    }

    if (connection === 'open') {
      isConnected = true;
      qrCode = null;
      console.log('✅ WhatsApp conectado');
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('❌ Conexión cerrada. Reconectando:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Solo grupos
      if (!msg.key.remoteJid?.endsWith('@g.us')) continue;
      if (msg.key.fromMe) continue;

      const groupName = process.env.WA_GROUP_NAME?.trim();

      // Verificar que sea el grupo correcto
      if (groupName) {
        try {
          const meta = await sock.groupMetadata(msg.key.remoteJid);
          if (meta.subject !== groupName) continue;
        } catch {
          continue;
        }
      }

      const msgType = Object.keys(msg.message || {})[0];
      const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];

      if (!mediaTypes.includes(msgType)) continue;

      console.log(`📥 Archivo recibido: ${msgType}`);

      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const ext = getExtension(msgType, msg.message);
        const docMsg = msg.message?.documentMessage;
        const filename = docMsg?.fileName || `${msgType.replace('Message', '')}_${Date.now()}.${ext}`;
        const mimeType = getMimeType(msgType);

        const uploaded = await uploadToDrive({ buffer, filename, mimeType });

        console.log(`✅ Subido a Drive: ${uploaded.name}`);
        addLog({ status: 'ok', filename: uploaded.name, link: uploaded.webViewLink });
      } catch (err) {
        console.error('❌ Error subiendo:', err.message);
        addLog({ status: 'error', filename: 'desconocido', error: err.message });
      }
    }
  });
}
