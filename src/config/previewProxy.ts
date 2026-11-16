import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Apply the same API proxy used by the dev server to the Vite preview server.
 * This is needed because Vite's `preview.proxy` option is currently buggy
 * and does not forward requests in production preview mode.
 */
export function applyPreviewProxy(server: any) {
  const proxyMap = {
    '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true, secure: false },
    '/alerts': { target: 'http://127.0.0.1:8001', changeOrigin: true, secure: false },
    '/reports': { target: 'http://127.0.0.1:8001', changeOrigin: true, secure: false },
  };
  Object.entries(proxyMap).forEach(([path, opts]) => {
    server.middlewares.use(path, createProxyMiddleware(opts));
  });
}
