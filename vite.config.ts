import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Custom plugin to reliably serve /assets in dev mode
function serveAssetsPlugin() {
  return {
    name: 'serve-assets',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && (req.url.startsWith('/assets/') || req.url.startsWith('assets/'))) {
          const cleanUrl = req.url.replace(/^\/?assets\//, '');
          const filePath = path.join(process.cwd(), 'assets', cleanUrl.split('?')[0]);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
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
