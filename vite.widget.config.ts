import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    define: {
        // Replace Node-style env vars with something browser-safe
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env": {}, // some libraries read process.env
    },
  
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  
    build: {
      lib: {
        entry: "src/anywidget/d3map-widget.tsx",
        formats: ["es"],
        fileName: () => "d3map.js",
      },
  
      rollupOptions: {
        // external: ["react", "react-dom"],
  
        // 👇 THIS IS THE KEY
        output: {
          inlineDynamicImports: true,
        },
      },
  
      target: "es2020",
      sourcemap: true,
      emptyOutDir: false,
    },
  });
  