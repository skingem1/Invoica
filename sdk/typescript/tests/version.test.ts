import { version, sdkUserAgent, isCompatibleApiVersion } from '../src/version';

describe('version', () => {
  it('exports a semver version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exports sdkUserAgent containing version', () => {
    expect(sdkUserAgent).toContain(version);
    expect(sdkUserAgent).toContain('countable-sdk-typescript');
  });

  it('isCompatibleApiVersion returns true for v1', () => {
    expect(isCompatibleApiVersion('1.0.0')).toBe(true);
    expect(isCompatibleApiVersion('1.5.2')).toBe(true);
  });

  it('isCompatibleApiVersion returns false for v2+', () => {
    expect(isCompatibleApiVersion('2.0.0')).toBe(false);
    expect(isCompatibleApiVersion('3.1.0')).toBe(false);
  });
});