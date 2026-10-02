import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
};

// Custom plugin to reliably serve /assets in dev mode
function serveAssetsPlugin() {
  return {
    name: 'serve-assets',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Do not intercept Vite module imports or queries (e.g. ?import)
        if (req.url && !req.url.includes('?') && (req.url.startsWith('/assets/') || req.url.startsWith('assets/'))) {
          const cleanUrl = req.url.replace(/^\/?assets\//, '');
          const filePath = path.join(process.cwd(), 'assets', cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            if (MIME_TYPES[ext]) {
              res.setHeader('Content-Type', MIME_TYPES[ext]);
            }
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveAssetsPlugin()],
  publicDir: 'public',
  server: {
    port: 5173,
    open: false,
  },
});
