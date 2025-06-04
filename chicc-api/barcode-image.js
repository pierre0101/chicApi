const fs = require('fs');
const path = require('path');
const bwipjs = require('bwip-js');

const dataDir = 'C:/Users/lllllll/Desktop/chicc-api';

fs.readdirSync(dataDir).forEach(filename => {
  if (!filename.endsWith('.json')) return;
  const filePath = path.join(dataDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');

  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    console.error(`Could not parse JSON in ${filename}:`, err.message);
    return;
  }

  // If the file is an array, process each item
  if (Array.isArray(data)) {
    let modified = false;
    let pending = data.length;

    if (pending === 0) return;

    data.forEach((product, idx) => {
      if (product.barcode) {
        bwipjs.toBuffer({
          bcid: 'code128',
          text: product.barcode,
          scale: 3,
          height: 12,
          includetext: true,
          textxalign: 'center',
          encoding: 'base64'
        }, function (err, pngBase64) {
          pending--;
          if (!err) {
            product.barcodeImg = 'data:image/png;base64,' + pngBase64;
            modified = true;
          } else {
            console.error(`Error generating barcode for item ${idx} in ${filename}:`, err.message);
          }
          if (pending === 0 && modified) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`Updated: ${filename}`);
          }
        });
      } else {
        pending--;
        if (pending === 0 && modified) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
          console.log(`Updated: ${filename}`);
        }
      }
    });
  } else if (data && typeof data === 'object' && data.barcode) {
    // If single product object (original logic)
    bwipjs.toBuffer({
      bcid: 'code128',
      text: data.barcode,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
      encoding: 'base64'
    }, function (err, pngBase64) {
      if (!err) {
        data.barcodeImg = 'data:image/png;base64,' + pngBase64;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Updated: ${filename}`);
      } else {
        console.error(`Error generating barcode for ${filename}:`, err.message);
      }
    });
  } else {
    console.warn(`No barcode in ${filename}, skipping...`);
  }
});
