import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outputDir = resolve('public');
const outputFile = resolve(outputDir, 'env.js');

const runtimeConfig = {
  apiUrl: process.env.API_URL,
  wsUrl: process.env.WS_URL,
  mapboxToken: process.env.MAPBOX_TOKEN,
  stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
};

mkdirSync(outputDir, { recursive: true });

const fileContents = `window.__env = ${JSON.stringify(runtimeConfig, null, 2)};\n`;
writeFileSync(outputFile, fileContents, 'utf-8');

console.log(`Archivo generado: ${outputFile}`);
