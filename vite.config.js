import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendPort = process.env.ADMIN_DEV_PORT || "5000";
const proxy = {
  "/api/admin": {
    target: "http://127.0.0.1:" + (/^\d{1,5}$/.test(backendPort) && +backendPort > 0 && +backendPort <= 65535 ? backendPort : "5000"),
    changeOrigin: true,
    proxyTimeout: 14000,
    configure(server) {
      server.on("proxyReq", (request) => {
        for (const name of ["authorization", "x-admin-proxy-key", "x-admin-client-ip", "x-forwarded-for"]) request.removeHeader(name);
      });
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy,
  },
  preview: { proxy },
});
