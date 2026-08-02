import type { CapacitorConfig } from '@capacitor/cli';

const appUrl = process.env.CAPACITOR_SERVER_URL || 'https://chinese-image-translator-ai-1.onrender.com';

const config: CapacitorConfig = {
  appId: 'vn.hanzilens.app',
  appName: 'Hanzi Lens',
  webDir: 'public',
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith('http://'),
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#f8faff',
  },
};

export default config;
