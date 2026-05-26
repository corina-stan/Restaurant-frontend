import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function serveExternalImages() {
  return {
    name: 'serve-external-images',
    configureServer(server) {
      server.middlewares.use('/external-images', (req, res, next) => {
        const brainPath = 'C:/Users/stanc/.gemini/antigravity/brain/e9afb3be-7b53-4e99-873f-0725bfed312b';
        const cleanUrl = req.url.split('?')[0];
        const filePath = path.join(brainPath, cleanUrl);
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
        } else {
          next();
        }
      });
    }
  }
}

export default defineConfig({
  plugins: [react(), serveExternalImages()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      }
    }
  }
})
