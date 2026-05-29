import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Auto-copy generated premium category images
try {
  const targetDir = path.join(__dirname, 'public/external-images')
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  const sourceDir = 'C:/Users/stanc/.gemini/antigravity/brain/aeef50a9-67e9-4b61-9f6f-cd87e342d84d'
  const mapping = {
    'pizza_1779961195096.png': 'pizza.png',
    'pasta_1779961209325.png': 'pasta.png',
    'dessert_1779961225045.png': 'dessert.png',
    'drinks_1779961239287.png': 'drinks.png',
    'soup_1779961251969.png': 'soup.png',
    'coffee_1779961271794.png': 'coffee.png'
  }
  for (const [sourceName, targetName] of Object.entries(mapping)) {
    const srcPath = path.join(sourceDir, sourceName)
    const destPath = path.join(targetDir, targetName)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
} catch (e) {
  console.error('Error copying images in config:', e)
}

function serveExternalImages() {
  return {
    name: 'serve-external-images',
    configureServer(server) {
      server.middlewares.use('/external-images', (req, res, next) => {
        const cleanUrl = req.url.split('?')[0];
        // 1. Check local public directory first
        const localPath = path.join(__dirname, 'public/external-images', cleanUrl);
        if (fs.existsSync(localPath)) {
          return next();
        }
        
        // 2. Fallback to old brain path
        const brainPath = 'C:/Users/stanc/.gemini/antigravity/brain/e9afb3be-7b53-4e99-873f-0725bfed312b';
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
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
