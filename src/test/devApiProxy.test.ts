import { describe, expect, it } from 'vitest';
import { devApiProxy } from '../config/devApiProxy';

describe('Vite local Django API proxy', () => {
  it('proxies relative API, alert, and report requests to the local backend', () => {
    for (const prefix of ['/api', '/alerts', '/reports']) {
      expect(devApiProxy[prefix as keyof typeof devApiProxy]).toEqual({
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      });
    }
  });
});
