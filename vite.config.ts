// @lovable.dev/vite-tanstack-config already includes TanStack Start,
// React, Tailwind, path aliases, etc.
// Do NOT add tanstackStart() manually because the wrapper already provides it.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig({
  // The Lovable wrapper normally adds Nitro with a Cloudflare preset.
  // Netlify has its own TanStack Start deployment adapter, so disable
  // the Cloudflare Nitro output and let the Netlify plugin handle deployment.
  nitro: false,

  // The wrapper appends these plugins after its internal plugins.
  plugins: [netlify()],

  tanstackStart: {
    // Keep the existing SSR error-wrapper entry unchanged.
    server: { entry: "server" },
  },
});
