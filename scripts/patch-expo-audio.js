const fs = require('fs');
const path = require('path');

const target = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'expo-audio',
  'build',
  'ExpoAudio.js'
);

if (!fs.existsSync(target)) {
  console.warn('[patch-expo-audio] ExpoAudio.js not found, skipping patch.');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

const before = src;

src = src.replace(
  "return useReleasingSharedObject(() => new AudioModule.AudioPlayer(parsedSource, updateInterval), [JSON.stringify(parsedSource)]);",
  "return useReleasingSharedObject(() => new AudioModule.AudioPlayer(parsedSource, updateInterval, 0), [JSON.stringify(parsedSource)]);"
);

src = src.replace(
  "return new AudioModule.AudioPlayer(parsedSource, updateInterval);",
  "return new AudioModule.AudioPlayer(parsedSource, updateInterval, 0);"
);

if (src !== before) {
  fs.writeFileSync(target, src, 'utf8');
  console.log('[patch-expo-audio] Patched AudioPlayer constructor to pass 3 arguments.');
} else {
  console.log('[patch-expo-audio] No changes needed (already patched or source changed).');
}
