import 'dotenv/config';
import crypto from 'crypto';

if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}

import { startBot } from './bot.js';
import { startServer } from './server.js';

console.log('🚀 Iniciando WspDriveBot...');

startServer();
startBot();
