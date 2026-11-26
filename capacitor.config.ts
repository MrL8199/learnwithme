import type { CapacitorConfig } from '@capacitor/cli'

/** Android app (see README, "App Android"). The web build in dist/ is copied into the APK. */
const config: CapacitorConfig = {
  appId: 'io.github.mrl8199.flashcard',
  appName: 'Flashcard',
  webDir: 'dist',
  android: {
    // Plain http:// requests are never needed (Apps Script is https).
    allowMixedContent: false,
  },
}

export default config
