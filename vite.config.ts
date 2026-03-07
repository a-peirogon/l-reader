import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
                            resolve: {
                              alias: { '@': path.resolve(__dirname, './src') },
                            },
                            // pdfjs-dist must NOT be excluded from optimizeDeps.
                            // When excluded, Vite serves it as raw ESM and GlobalWorkerOptions is not
                            // available as a named export in v3.x — it only exists on the default export
                            // object that Vite's pre-bundler produces. Removing the exclude lets Vite
                            // wrap it into a proper CJS-compatible bundle where .default.GlobalWorkerOptions
                            // (and the top-level interop alias) work correctly.
})
