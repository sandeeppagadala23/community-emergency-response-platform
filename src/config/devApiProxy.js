export const devApiProxy = {
  '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true },
  '/alerts': { target: 'http://127.0.0.1:8001', changeOrigin: true },
  '/reports': { target: 'http://127.0.0.1:8001', changeOrigin: true },
};
