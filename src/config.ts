/**
 * The Apps Script web app every user of this build connects to.
 * Override at build time with VITE_API_URL (e.g. for a test deployment).
 * Not a secret: reading data or syncing still needs an account.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL ||
  'https://script.google.com/macros/s/AKfycbyorfW8pCCCtHMYH2nTiDXQIKQwBmqOtgmZT_5Kr1tOY1SKT8FWXCuwK_kJk1ETpvm_2Q/exec'
