import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.radiotecpro.omnichat',
  appName: 'OmniChat',
  webDir: 'public',
  server: {
    url: 'https://omnichat.radiotecpro.com',
    cleartext: true
  }
};

export default config;
