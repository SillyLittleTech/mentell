const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const WIX_URLS = [
  'https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip',
  'https://wixtoolset.org/downloads/wix3141rtm/wix314-binaries.zip',
];

async function downloadWix() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const destDir = path.join(localAppData, 'tauri', 'WixTools');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destFile = path.join(destDir, 'wix314-binaries.zip');

  // Check if it's already extracted by looking for candle.exe
  if (fs.existsSync(path.join(destDir, 'candle.exe'))) {
    console.log('Wix binaries already exist and are extracted');
    return;
  }

  if (!fs.existsSync(destFile)) {
    let downloaded = false;
    for (let i = 0; i < 3; i++) {
      for (const url of WIX_URLS) {
        console.log(`Trying ${url}...`);
        try {
          await new Promise((resolve, reject) => {
            https.get(url, (res) => {
               if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                  // handle redirect
                  https.get(res.headers.location, (res2) => {
                      if (res2.statusCode !== 200) {
                          reject(new Error(`Failed to download: ${res2.statusCode}`));
                          return;
                      }
                      const file = fs.createWriteStream(destFile);
                      res2.pipe(file);
                      file.on('finish', () => {
                        file.close(resolve);
                      });
                  }).on('error', reject);
               } else {
                   if (res.statusCode !== 200) {
                      reject(new Error(`Failed to download: ${res.statusCode}`));
                      return;
                   }
                   const file = fs.createWriteStream(destFile);
                   res.pipe(file);
                   file.on('finish', () => {
                     file.close(resolve);
                   });
               }
            }).on('error', reject);
          });
          console.log('Successfully downloaded wix binaries');
          downloaded = true;
          break;
        } catch (err) {
          console.error(`Failed: ${err.message}`);
        }
      }
      if (downloaded) break;
      console.log('Waiting before retry...');
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!downloaded) {
      throw new Error('Failed to download wix binaries after multiple attempts');
    }
  } else {
    console.log('Wix zip already exists, skipping download');
  }

  // Extract the zip
  console.log('Extracting Wix binaries...');
  try {
    // Attempt to use powershell since this runs on windows runners
    execSync(`powershell -command "Expand-Archive -Force -Path '${destFile}' -DestinationPath '${destDir}'"`);
    console.log('Extraction complete');
  } catch (err) {
    console.error('Failed to extract with powershell, trying tar', err.message);
    try {
      execSync(`tar -xf "${destFile}" -C "${destDir}"`);
      console.log('Extraction complete');
    } catch(err2) {
      console.error('Failed to extract with tar too', err2.message);
      throw err2;
    }
  }
}

downloadWix().catch(err => {
  console.error(err);
  process.exit(1);
});
