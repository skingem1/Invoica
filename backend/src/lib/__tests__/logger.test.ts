import { logger } from '../logger';

describe('lib/logger', () => {
  let spy: { log: jest.SpyInstance; warn: jest.SpyInstance; error: jest.SpyInstance; debug: jest.SpyInstance };

  beforeEach(() => {
    spy = {
      log:   jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn:  jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('info()', () => {
    it('calls console.log for info level', () => {
      logger.info('hello world');
      expect(spy.log).toHaveBeenCalledTimes(1);
    });

    it('message+meta call signature includes message text', () => {
      logger.info('test message', { key: 'value' });
      const output = spy.log.mock.calls[0][0] as string;
      expect(output).toContain('test message');
    });

    it('meta+message call signature (object first) includes message text', () => {
      logger.info({ key: 'value' }, 'test message meta-first');
      const output = spy.log.mock.calls[0][0] as string;
      expect(output).toContain('test message meta-first');
    });
  });

  describe('warn()', () => {
    it('calls console.warn for warn level', () => {
      logger.warn('warning here');
      expect(spy.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('error()', () => {
    it('calls console.error for error level', () => {
      logger.error('something broke');
      expect(spy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('debug()', () => {
    it('calls console.debug for debug level', () => {
      logger.debug('debug trace');
      expect(spy.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe('production mode', () => {
    beforeEach(() => { process.env.NODE_ENV = 'production'; });
    afterEach(() => { process.env.NODE_ENV = 'test'; });

    it('outputs valid JSON in production', () => {
      logger.info('prod message', { requestId: 'r-123' });
      const raw = spy.log.mock.calls[0][0] as string;
      expect(() => JSON.parse(raw)).not.toThrow();
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('prod message');
      expect(parsed.requestId).toBe('r-123');
    });

    it('includes timestamp in production JSON', () => {
      logger.info('ts check');
      const parsed = JSON.parse(spy.log.mock.calls[0][0] as string);
      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });
  });
});
