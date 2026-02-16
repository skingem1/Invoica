import { detectEnvironment, getDefaultBaseUrl, getUserAgent, supportsStreaming } from '../src/environment';

describe('detectEnvironment', () => {
  it('returns node in Node.js environment', () => {
    expect(detectEnvironment()).toBe('node');
  });
});

describe('getDefaultBaseUrl', () => {
  it('returns the production API URL', () => {
    expect(getDefaultBaseUrl()).toBe('https://api.invoica.ai/v1');
  });
});

describe('getUserAgent', () => {
  it('includes sdk name and environment', () => {
    const ua = getUserAgent();
    expect(ua).toContain('invoica-sdk');
    expect(ua).toContain('node');
  });
});

describe('supportsStreaming', () => {
  it('returns a boolean', () => {
    expect(typeof supportsStreaming()).toBe('boolean');
  });
});