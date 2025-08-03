import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: '',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'default_font_urls.txt', dest: '.' },
        { src: 'SE_Favicon.png', dest: '.' },
        { src: 'README.md', dest: '.' }
      ]
    })
  ]
})