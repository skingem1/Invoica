import request from 'supertest';
import { app } from '../../app';

describe('Tax Routes', () => {
  describe('POST /v1/tax/calculate', () => {
    it('returns 7.25% for US California buyer', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 10000, buyerLocation: { countryCode: 'US', stateCode: 'CA' } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taxRate).toBe(0.0725);
      expect(res.body.data.taxAmount).toBe(725);
      expect(res.body.data.jurisdiction).toBe('US');
    });

    it('returns 19% for German B2C buyer', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 10000, buyerLocation: { countryCode: 'DE' } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taxRate).toBe(0.19);
      expect(res.body.data.taxAmount).toBe(1900);
      expect(res.body.data.jurisdiction).toBe('EU');
    });

    it('returns 0% for German B2B buyer (VAT number = reverse charge)', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 10000, buyerLocation: { countryCode: 'DE', vatNumber: 'DE123456789' } });
      expect(res.status).toBe(200);
      expect(res.body.data.taxRate).toBe(0);
      expect(res.body.data.taxAmount).toBe(0);
      expect(res.body.data.jurisdiction).toBe('EU');
      expect(res.body.data.invoiceNote).toMatch(/reverse charge/i);
    });

    it('returns 0% for unsupported jurisdiction (JP)', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 10000, buyerLocation: { countryCode: 'JP' } });
      expect(res.status).toBe(200);
      expect(res.body.data.taxRate).toBe(0);
      expect(res.body.data.jurisdiction).toBe('NONE');
    });

    it('returns 400 for missing amount', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ buyerLocation: { countryCode: 'US', stateCode: 'NY' } });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing buyerLocation', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 5000 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing countryCode', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 5000, buyerLocation: { stateCode: 'CA' } });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns correct totalAmount', async () => {
      const res = await request(app)
        .post('/v1/tax/calculate')
        .send({ amount: 10000, buyerLocation: { countryCode: 'US', stateCode: 'TX' } });
      expect(res.status).toBe(200);
      expect(res.body.data.taxRate).toBe(0.0625);
      expect(res.body.data.totalAmount).toBe(10000 + 625);
    });
  });

  describe('GET /v1/tax/jurisdictions', () => {
    it('returns US and EU jurisdiction data', async () => {
      const res = await request(app).get('/v1/tax/jurisdictions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.us).toBeDefined();
      expect(res.body.data.eu).toBeDefined();
    });

    it('includes California in US nexus states', async () => {
      const res = await request(app).get('/v1/tax/jurisdictions');
      const ca = res.body.data.us.rates.find((r: any) => r.stateCode === 'CA');
      expect(ca).toBeDefined();
      expect(ca.rate).toBe(0.0725);
    });

    it('includes Germany in EU VAT rates', async () => {
      const res = await request(app).get('/v1/tax/jurisdictions');
      const de = res.body.data.eu.rates.find((r: any) => r.countryCode === 'DE');
      expect(de).toBeDefined();
      expect(de.rate).toBe(0.19);
    });
  });
});
