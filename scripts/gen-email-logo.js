/**
 * Gera lib/email-logo.png a partir do favicon.svg (usada no template de email).
 * Requer: npm install sharp (apenas para geração, não para runtime).
 * Uso: node scripts/gen-email-logo.js
 */
'use strict';
const path  = require('path');
const fs    = require('fs');
const sharp = require('sharp');

const src  = path.join(__dirname, '..', 'favicon.svg');
const dest = path.join(__dirname, '..', 'lib', 'email-logo.png');

sharp(src)
  .resize(36, 36)
  .png({ compressionLevel: 9 })
  .toFile(dest, function (err) {
    if (err) { console.error('Erro:', err.message); process.exit(1); }
    const size = fs.statSync(dest).size;
    console.log('Gerado: ' + dest + ' (' + size + ' bytes)');
  });
