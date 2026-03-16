import { sendWelcomeEmail } from '../welcome-email';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

describe('sendWelcomeEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns without creating a transporter when SMTP_USER is not set', async () => {
    delete process.env.SMTP_USER;
    await sendWelcomeEmail('user@example.com', 'inv_1234');
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('creates a transporter and sends email when SMTP_USER is configured', async () => {
    process.env.SMTP_USER = 'smtp@example.com';
    process.env.SMTP_PASS = 'secret';
    mockSendMail.mockResolvedValueOnce({ messageId: 'test-id' });

    await sendWelcomeEmail('user@example.com', 'inv_1234');

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'smtp@example.com', pass: 'secret' },
      })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Welcome to Invoica'),
      })
    );
  });

  it('includes the apiKeyPrefix in the email body', async () => {
    process.env.SMTP_USER = 'smtp@example.com';
    mockSendMail.mockResolvedValueOnce({});

    await sendWelcomeEmail('user@example.com', 'inv_ABCD');

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.text).toContain('inv_ABCD');
    expect(mailOptions.html).toContain('inv_ABCD');
  });

  it('does not throw when sendMail rejects (non-critical operation)', async () => {
    process.env.SMTP_USER = 'smtp@example.com';
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    await expect(
      sendWelcomeEmail('user@example.com', 'inv_1234')
    ).resolves.toBeUndefined();
  });

  it('uses default SMTP host when SMTP_HOST is not set', async () => {
    process.env.SMTP_USER = 'smtp@example.com';
    delete process.env.SMTP_HOST;
    mockSendMail.mockResolvedValueOnce({});

    await sendWelcomeEmail('user@example.com', 'inv_1234');

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com' })
    );
  });

  afterAll(() => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
  });
});
