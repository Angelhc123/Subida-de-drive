import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = './tokens.json';
let currentFolderId = process.env.DRIVE_FOLDER_ID || '';

export function getFolderId() { return currentFolderId; }
export function setFolderId(id) { currentFolderId = id; }

function getOAuthClient() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  // Primero intenta leer tokens del archivo (persiste en Railway con volume)
  let tokens = null;
  if (fs.existsSync(TOKEN_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } else if (process.env.GOOGLE_REFRESH_TOKEN) {
    tokens = { refresh_token: process.env.GOOGLE_REFRESH_TOKEN };
  }

  if (!tokens) throw new Error('No hay tokens de Google configurados. Corre setup.js primero.');

  oAuth2Client.setCredentials(tokens);

  // Auto-guardar tokens nuevos cuando se renuevan
  oAuth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged));
  });

  return oAuth2Client;
}

export async function uploadToDrive({ buffer, filename, mimeType }) {
  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = getFolderId();

  if (!folderId) throw new Error('No hay carpeta de Drive configurada');

  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: stream,
    },
    fields: 'id, name, webViewLink',
  });

  return res.data;
}

export async function getFolderInfo(folderIdOrUrl) {
  // Extrae el ID si pegan una URL completa de Drive
  const id = extractFolderId(folderIdOrUrl);
  if (!id) return null;

  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.get({
      fileId: id,
      fields: 'id, name',
    });
    return { ...res.data, cleanId: id };
  } catch {
    return null;
  }
}

export function extractFolderId(input) {
  if (!input) return null;
  // Si es URL de Drive, extrae el ID
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Si ya es solo el ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return null;
}
