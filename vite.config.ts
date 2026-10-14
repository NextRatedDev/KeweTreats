import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'supabase-vendor',
              test: /node_modules[\\/](?:@supabase|@realtime|@standard-schema)[\\/]/,
              priority: 10,
            },
            {
              name: 'ui-vendor',
              test: /node_modules[\\/](?:lucide-react|react-router|@remix-run|react-hook-form|@hookform|zod|sonner)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
