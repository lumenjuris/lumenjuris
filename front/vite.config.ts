// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     exclude: ['lucide-react'],
//   },
//   define: {
//     global: 'globalThis',
//   },
//   server: {
//     port: 5173,
//     strictPort: true,
//     host: 'localhost',
//     hmr: {
//       port: 5173,
//       host: 'localhost',
//     },
//     proxy: {
//       '/api': {
//         target: 'http://localhost:5678',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api/, ''),
//       },
//       '/extract-pdf-text': {
//         target: 'http://localhost:5678',
//         changeOrigin: true,
//       },
//       '/legifrance-search': {
//         target: 'http://localhost:5678',
//         changeOrigin: true,
//       },
//       '/jurisprudence': {
//         target: 'http://localhost:5678',
//         changeOrigin: true,
//       },
//       '/analyze-clause': {
//         target: 'http://localhost:5678',
//         changeOrigin: true,
//       },
//       '/chat': {
//         target: 'http://localhost:5678',
//         changeOrigin: true,
//       },
//     },
//   },
// });
//
//



import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['lucide-react'], // pré-bundle des icônes
  },
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    proxy: {
      '/api': { target: 'http://localhost:5678', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/extract-pdf-text': { target: 'http://localhost:5678', changeOrigin: true },
      '/legifrance-search': { target: 'http://localhost:5678', changeOrigin: true },
      '/jurisprudence': { target: 'http://localhost:5678', changeOrigin: true },
      '/analyze-clause': { target: 'http://localhost:5678', changeOrigin: true },
      '^/chat$': { target: 'http://localhost:5678', changeOrigin: true },
    },
  },
})
