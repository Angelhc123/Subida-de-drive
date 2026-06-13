import 'dotenv/config';
import { startBot } from './bot.js';
import { startServer } from './server.js';

console.log('🚀 Iniciando WspDriveBot...');

startServer();
startBot();
