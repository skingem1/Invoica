import { xssProtection } from '../security';

describe('security/xss', () => {
  const next = jest.fn();
  const req: any = { body: {}, query: {} };
  const res: any = {};

  beforeEach(() => { req.body = {}; req.query = {}; next.mockClear(); });

  it('calls next()', () => { xssProtection(req, res, next); expect(next).toHaveBeenCalled(); });

  it('removes HTML tags from req.body', () => {
    req.body = { name: '<script>alert(1)</script>hello' };
    xssProtection(req, res, next);
    expect(req.body.name).toContain('hello');
    expect(req.body.name).not.toContain('<script>');
  });

  it('encodes angle brackets remaining after tag removal in req.body', () => {
    req.body = { text: 'a<b' };
    xssProtection(req, res, next);
    // '<b' is not a complete tag so the replace(/<[^>]*>/g) won't remove it
    // it stays as 'a<b' then '<' gets encoded to '&lt;'
    expect(req.body.text).toContain('&lt;');
  });

  it('sanitizes nested objects in req.body by removing HTML tags', () => {
    req.body = { user: { name: '<b>evil</b>' } };
    xssProtection(req, res, next);
    // '<b>evil</b>' — tags <b> and </b> are removed, leaving 'evil'
    expect(req.body.user.name).toBe('evil');
    expect(req.body.user.name).not.toContain('<b>');
  });

  it('sanitizes req.query values', () => {
    req.query = { search: '<script>xss</script>' };
    xssProtection(req, res, next);
    expect(req.query.search).not.toContain('<script>');
  });
});
