import {
  SIGNATURE_HEADER,
  generateSignature,
  verifySignature,
  generateWebhookSecret,
} from '../webhook-signature';

describe('webhook-signature', () => {
  const payload = '{"event":"test"}';
  const secret = 'test-secret-key';

  it('generateSignature returns string starting with sha256=', () => {
    const sig = generateSignature(payload, secret);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('generateSignature is deterministic', () => {
    const sig1 = generateSignature(payload, secret);
    const sig2 = generateSignature(payload, secret);
    expect(sig1).toBe(sig2);
  });

  it('verifySignature returns true for valid signature', () => {
    const sig = generateSignature(payload, secret);
    expect(verifySignature(payload, secret, sig)).toBe(true);
  });

  it('verifySignature returns false for wrong secret', () => {
    const sig = generateSignature(payload, secret);
    expect(verifySignature(payload, 'wrong-secret', sig)).toBe(false);
  });

  it('generateWebhookSecret returns whsec_ prefix with 54 chars', () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[a-f0-9]{48}$/);
    expect(secret.length).toBe(54);
  });
});