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

      console.log('❌ Conexión cerrada. Error:', lastDisconnect?.error, 'Reconectando:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      console.log('\n--- 📥 NUEVO MENSAJE DETECTADO ---');
      
      // 1. Verificar si es de un grupo
      const isGroup = msg.key.remoteJid?.endsWith('@g.us');
      if (!isGroup) {
        console.log(`⚠️ Ignorado: No proviene de un grupo (remitente: ${msg.key.remoteJid}).`);
        continue;
      }

      // 2. Verificar si es del propio bot
      if (msg.key.fromMe) {
        console.log('⚠️ Ignorado: Mensaje enviado por el propio bot (fromMe).');
        continue;
      }

      // 3. Verificar el nombre del grupo
      const groupName = process.env.WA_GROUP_NAME?.trim();
      if (groupName) {
        try {
          const meta = await sock.groupMetadata(msg.key.remoteJid);
          console.log(`👥 Grupo origen: "${meta.subject}"`);
          if (meta.subject !== groupName) {
            console.log(`⚠️ Ignorado: El nombre del grupo no coincide. Se esperaba "${groupName}" pero es "${meta.subject}".`);
            continue;
          }
        } catch (err) {
          console.log(`⚠️ Error al obtener metadata del grupo: ${err.message}`);
          continue;
        }
      } else {
        console.log('ℹ️ Procesando mensaje de cualquier grupo (WA_GROUP_NAME no configurado).');
      }

      // 4. Desembalar mensaje si viene en contenedores como efímeros o vista única
      let messageContent = msg.message;
      if (!messageContent) {
        console.log('⚠️ Ignorado: El mensaje no contiene datos (.message está vacío).');
        continue;
      }

      if (messageContent.ephemeralMessage) {
        console.log('ℹ️ Desembalando mensaje efímero (ephemeralMessage)...');
        messageContent = messageContent.ephemeralMessage.message;
      }
      if (messageContent.viewOnceMessage) {
        console.log('ℹ️ Desembalando mensaje de vista única (viewOnceMessage)...');
        messageContent = messageContent.viewOnceMessage.message;
      }
      if (messageContent.viewOnceMessageV2) {
        console.log('ℹ️ Desembalando mensaje de vista única V2 (viewOnceMessageV2)...');
        messageContent = messageContent.viewOnceMessageV2.message;
      }
      if (messageContent.documentWithCaptionMessage) {
        console.log('ℹ️ Desembalando documento con leyenda (documentWithCaptionMessage)...');
        messageContent = messageContent.documentWithCaptionMessage.message;
      }

      if (!messageContent) {
        console.log('⚠️ Ignorado: Contenido interno del mensaje vacío tras desembalar.');
        continue;
      }

      // 5. Determinar el tipo de mensaje
      const msgType = Object.keys(messageContent)[0];
      console.log(`🔍 Tipo de mensaje detectado: "${msgType}"`);

      const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];

      if (!mediaTypes.includes(msgType)) {
        console.log(`ℹ️ Ignorado: Tipo de mensaje "${msgType}" no es multimedia/archivo.`);
        continue;
      }

      console.log(`📥 Procesando archivo recibido de tipo: ${msgType}`);

      try {
        const cleanMsg = { ...msg, message: messageContent };
        console.log('⏳ Descargando archivo desde WhatsApp...');
        const buffer = await downloadMediaMessage(cleanMsg, 'buffer', {});
        console.log(`✅ Archivo descargado con éxito. Tamaño: ${buffer.length} bytes`);

        const ext = getExtension(msgType, messageContent);
        const docMsg = messageContent.documentMessage;
        const filename = docMsg?.fileName || `${msgType.replace('Message', '')}_${Date.now()}.${ext}`;
        const mimeType = getMimeType(msgType);

        console.log(`⏳ Subiendo a Google Drive... Nombre: "${filename}", MimeType: "${mimeType}"`);
        const uploaded = await uploadToDrive({ buffer, filename, mimeType });

        console.log(`✅ ¡Subido con éxito a Drive! ID: ${uploaded.id}, Nombre: ${uploaded.name}`);
        addLog({ status: 'ok', filename: uploaded.name, link: uploaded.webViewLink });
      } catch (err) {
        console.error('❌ Error durante el procesamiento o subida:', err.stack || err.message);
        addLog({ status: 'error', filename: 'desconocido', error: err.message });
      }
    }
  });
}
