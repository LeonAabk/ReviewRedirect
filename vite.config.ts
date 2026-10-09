import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {defineConfig} from 'vite';

dotenv.config();

function injectEnvMiddleware() {
  return {
    name: 'inject-env-middleware',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const parsedUrl = req.url ? req.url.split('?')[0] : '';
        if (parsedUrl === '/r.html' || parsedUrl === '/admin.html') {
          const fileName = parsedUrl.slice(1);
          // Check public first, then root
          let filePath = path.resolve(__dirname, 'public', fileName);
          if (!fs.existsSync(filePath)) {
            filePath = path.resolve(__dirname, fileName);
          }
          if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf-8');
            const sbUrl = process.env.VITE_SUPABASE_URL || '';
            const sbKey = process.env.VITE_SUPABASE_ANON_KEY || '';
            content = content
              .replace("const SUPABASE_URL = '';", `const SUPABASE_URL = '${sbUrl}';`)
              .replace("const SUPABASE_ANON_KEY = '';", `const SUPABASE_ANON_KEY = '${sbKey}';`);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(content);
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), injectEnvMiddleware()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
