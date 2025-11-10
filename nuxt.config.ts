// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  modules: ["@nuxt/ui-pro"],
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://parentapi.test/api', // used if you skip the proxy
    },
  },

  // Avoid CORS in dev by proxying /api/* to Laravel's dev server
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://parentapi.test',
        changeOrigin: true,
      },
    },
  },

});
