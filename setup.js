#!/usr/bin/env node
// Script de configuración - córrelo UNA SOLA VEZ localmente
// Genera tu GOOGLE_REFRESH_TOKEN para poner en Railway

import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'readline';
import fs from 'fs';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en tu .env\n');
  console.log('Sigue los pasos del README para obtenerlos desde Google Cloud Console.\n');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // Fuerza que entregue refresh_token
});

console.log('\n======================================');
console.log('  Configuración de Google Drive');
console.log('======================================\n');
console.log('1. Abre este link en tu navegador:\n');
console.log('   ' + authUrl);
console.log('\n2. Inicia sesión con la cuenta Gmail que tiene acceso a la carpeta de Drive');
console.log('3. Acepta los permisos');
console.log('4. Copia el código que aparece y pégalo aquí:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Código: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    
    // Guarda tokens localmente
    fs.writeFileSync('./tokens.json', JSON.stringify(tokens, null, 2));
    
    console.log('\n✅ ¡Listo! Tokens guardados en tokens.json\n');
    console.log('======================================');
    console.log('  Copia esto a tus variables en Railway:');
    console.log('======================================\n');
    console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n(También puedes subir tokens.json a un Volume de Railway)\n');
  } catch (err) {
    console.error('\n❌ Error al obtener tokens:', err.message);
    console.log('Verifica que el código sea correcto e inténtalo de nuevo.\n');
  }
});
