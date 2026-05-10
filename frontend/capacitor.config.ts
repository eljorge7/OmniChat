import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.radiotecpro.omnichat',
  appName: 'OmniChat',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://omnichat.radiotecpro.com',
    cleartext: true
  }
};

export default config;
