/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE: "/" locally; "/<repo-name>/" when hosted on GitHub Pages (set in the deploy workflow).
export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Flashcard – học từ 7 ngày',
        short_name: 'Flashcard',
        description: 'Học từ vựng từ Google Sheet theo lịch 7 ngày',
        lang: 'vi',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#2f6fde',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
