import { Router, Request, Response, NextFunction } from 'express';
import { calculateTax, US_NEXUS_RATES } from '../services/tax/calculator';

const router = Router();

const EU_VAT_RATES: Record<string, number> = {
  AT: 0.20, BE: 0.21, BG: 0.20, HR: 0.25, CY: 0.19, CZ: 0.21,
  DK: 0.25, EE: 0.22, FI: 0.24, FR: 0.20, DE: 0.19, GR: 0.24,
  HU: 0.27, IE: 0.23, IT: 0.22, LV: 0.21, LT: 0.21, LU: 0.17,
  MT: 0.18, NL: 0.21, PL: 0.23, PT: 0.23, RO: 0.19, SK: 0.20,
  SI: 0.22, ES: 0.21, SE: 0.25, GB: 0.20, UK: 0.20,
};

/**
 * POST /v1/tax/calculate
 * Calculate applicable tax for a given amount and buyer location.
 * Body: { amount: number, buyerLocation: { countryCode, stateCode?, vatNumber? } }
 */
router.post('/v1/tax/calculate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, buyerLocation } = req.body;

    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({
        success: false,
        error: { message: 'amount must be a positive number', code: 'INVALID_AMOUNT' },
      });
      return;
    }
    if (!buyerLocation || typeof buyerLocation !== 'object') {
      res.status(400).json({
        success: false,
        error: { message: 'buyerLocation is required', code: 'MISSING_FIELD' },
      });
      return;
    }
    if (!buyerLocation.countryCode || typeof buyerLocation.countryCode !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'buyerLocation.countryCode is required', code: 'MISSING_FIELD' },
      });
      return;
    }

    const result = calculateTax({
      amount: Number(amount),
      buyerLocation: {
        countryCode: buyerLocation.countryCode,
        stateCode: buyerLocation.stateCode,
        vatNumber: buyerLocation.vatNumber,
      },
    });

    res.json({
      success: true,
      data: {
        amount: Number(amount),
        taxRate: result.taxRate,
        taxAmount: result.taxAmount,
        totalAmount: Number(amount) + result.taxAmount,
        jurisdiction: result.jurisdiction,
        invoiceNote: result.invoiceNote || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/tax/jurisdictions
 * Return supported tax jurisdictions with their rates.
 */
router.get('/v1/tax/jurisdictions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      us: {
        jurisdiction: 'US',
        description: 'US sales tax (nexus-based)',
        rates: Object.entries(US_NEXUS_RATES).map(([state, rate]) => ({
          stateCode: state,
          rate,
          ratePercent: `${(rate * 100).toFixed(2)}%`,
        })),
      },
      eu: {
        jurisdiction: 'EU',
        description: 'EU VAT (B2C standard rates; B2B reverse charge applies)',
        rates: Object.entries(EU_VAT_RATES).map(([country, rate]) => ({
          countryCode: country,
          rate,
          ratePercent: `${(rate * 100).toFixed(0)}%`,
        })),
      },
    },
  });
});

export default router;
