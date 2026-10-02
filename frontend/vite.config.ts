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

export default defineConfig({
  plugins: [react(), serveAssetsPlugin()],
  publicDir: 'public',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'three-vendor';
            }
            if (id.includes('gsap') || id.includes('lenis')) {
              return 'animation-vendor';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'react-vendor';
            }
          }
        },
      },
    },
  },
});
