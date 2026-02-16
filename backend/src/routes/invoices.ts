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

router.get('/v1/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await getInvoiceById(req.params.id);
    if (!invoice) { res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } }); return; }
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

router.get('/v1/invoices/number/:number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await getInvoiceByNumber(req.params.number);
    if (!invoice) { res.status(404).json({ success: false, error: { message: 'Invoice not found', code: 'NOT_FOUND' } }); return; }
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

export default router;