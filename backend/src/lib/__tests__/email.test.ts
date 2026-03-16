const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

// Import AFTER mock is set up — the module creates the transporter at module level
import { sendVerificationEmail } from '../email';

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
  });

  it('calls sendMail once per invocation', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'msg-1' });
    await sendVerificationEmail('user@example.com', '123456');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('sends to the correct recipient', async () => {
    mockSendMail.mockResolvedValueOnce({});
    await sendVerificationEmail('recipient@test.com', '654321');
    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.to).toBe('recipient@test.com');
  });

  it('includes the verification code in the email body (text)', async () => {
    mockSendMail.mockResolvedValueOnce({});
    await sendVerificationEmail('a@b.com', '999888');
    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.text).toContain('999888');
  });

  it('includes the verification code in the HTML body', async () => {
    mockSendMail.mockResolvedValueOnce({});
    await sendVerificationEmail('a@b.com', 'ABC123');
    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.html).toContain('ABC123');
  });

  it('sets subject to ledger access verification', async () => {
    mockSendMail.mockResolvedValueOnce({});
    await sendVerificationEmail('a@b.com', '000000');
    const opts = mockSendMail.mock.calls[0][0];
    expect(opts.subject).toContain('Verification');
  });

  it('propagates sendMail errors (non-silent unlike welcome-email)', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP timeout'));
    await expect(sendVerificationEmail('a@b.com', '111111')).rejects.toThrow('SMTP timeout');
  });
});
