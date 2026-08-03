import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read VERSION
const versionPath = path.join(rootDir, 'VERSION');
const version = fs.readFileSync(versionPath, 'utf8').trim();
console.log(`Syncing version to: ${version}`);

// Update package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('Updated package.json');

// Run npm i --package-lock-only to update package-lock.json based on new package.json
try {
  execSync('npm i --package-lock-only --ignore-scripts', { cwd: rootDir, stdio: 'inherit' });
  console.log('Updated package-lock.json');
} catch (e) {
  console.error('Failed to update package-lock.json:', e);
}

// Update tauri.conf.json (use regex to avoid reformatting the whole file and changing array styles)
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
let tauriConfStr = fs.readFileSync(tauriConfPath, 'utf8');
tauriConfStr = tauriConfStr.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`);
fs.writeFileSync(tauriConfPath, tauriConfStr);
console.log('Updated tauri.conf.json');

// Update android/app/build.gradle
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/g, `versionName "${version}"`);
  fs.writeFileSync(buildGradlePath, buildGradle);
  console.log('Updated android/app/build.gradle');
}
