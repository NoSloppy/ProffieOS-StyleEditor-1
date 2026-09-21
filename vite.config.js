import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: './',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'default_font_urls.txt', dest: '.' },
        { src: 'image_use.txt', dest: '.' },
        { src: 'LICENSE.txt', dest: '.' },
        { src: 'README.md', dest: '.' },
        { src: 'SE_Favicon_BC.png', dest: '.' }
      ]
    })
  ]
})