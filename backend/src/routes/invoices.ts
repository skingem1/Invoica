import { Router, Request, Response, NextFunction } from 'express';
import { createPendingInvoice, getInvoiceById, getInvoiceByNumber, CreateInvoiceInputSchema } from '../services/invoice';

const router = Router();

router.post('/v1/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateInvoiceInputSchema.parse(req.body);
    const invoice = await createPendingInvoice(parsed);
    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// IMPORTANT: /number/:number MUST be before /:id to avoid Express matching "number" as an id
router.get('/v1/invoices/number/:number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceNumber = parseInt(req.params.number, 10);
    if (isNaN(invoiceNumber)) {
      res.status(400).json({ success: false, error: { message: 'Invalid invoice number', code: 'INVALID_NUMBER' } });
      return;
    }
    const invoice = await getInvoiceByNumber(invoiceNumber);
    if (!invoice) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

router.get('/v1/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await getInvoiceById(req.params.id);
    if (!invoice) {
      res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

export default router;
