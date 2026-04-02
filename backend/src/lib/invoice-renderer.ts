/**
 * invoice-renderer.ts — Renders Invoica invoice as HTML string
 * Includes AMD-22 tax line section when paymentDetails.tax_line is present.
 * No external dependencies — returns raw HTML for /v1/invoices/:id/download endpoint.
 */

export interface TaxLineData {
  total_tax: number;
  rate: number;
  jurisdiction: string;
  statute?: string;
  confidence_level?: string;
  requires_review?: boolean;
  classification_basis?: string;
}

export interface PaymentDetails {
  tax_line?: TaxLineData | null;
  network?: string | null;
  txHash?: string | null;
}

export interface InvoiceRenderData {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number | string;
  currency: string;
  customerEmail?: string | null;
  customerName?: string | null;
  createdAt: string;
  paymentDetails?: PaymentDetails | null;
}

/**
 * Renders an InvoiceRenderData object as an HTML string.
 * Conditionally includes AMD-22 tax line section when paymentDetails.tax_line is present.
 * 
 * @param inv - The invoice data to render
 * @returns Complete HTML string representing the invoice
 */
export function renderInvoiceHtml(inv: InvoiceRenderData): string {
  const tl = inv.paymentDetails?.tax_line;
  
  const taxSection = tl
    ? `
    <tr style="border-top:1px solid #eee;">
      <td colspan="2" style="padding:12px 0 4px;"><strong>Tax Line (AMD-22)</strong></td>
    </tr>
    <tr>
      <td style="color:#555;">Jurisdiction</td>
      <td style="text-align:right;">${tl.jurisdiction}</td>
    </tr>
    <tr>
      <td style="color:#555;">Rate</td>
      <td style="text-align:right;">${(tl.rate * 100).toFixed(3)}%</td>
    </tr>
    <tr>
      <td style="color:#555;">Tax Amount</td>
      <td style="text-align:right;">${tl.total_tax.toFixed(6)} ${inv.currency}</td>
    </tr>
    ${tl.statute ? `<tr><td style="color:#555;">Statute</td><td style="text-align:right;font-size:12px;">${tl.statute}</td></tr>` : ''}
    ${tl.requires_review ? `<tr><td colspan="2" style="color:#d97706;font-size:12px;">⚠ Tax calculation flagged for review (confidence: ${tl.confidence_level})</td></tr>` : ''}
  `
    : '';

  const network = inv.paymentDetails?.network || 'N/A';
  const txHash = inv.paymentDetails?.txHash
    ? `<a href="#" style="color:#635BFF;font-size:12px;">${inv.paymentDetails.txHash}</a>`
    : 'N/A';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:40px auto;padding:0 24px;color:#111;}table{width:100%;border-collapse:collapse;}td{padding:8px 0;}</style></head><body>
  <img src="https://invoica.ai/logo.png" alt="Invoica" style="height:40px;margin-bottom:24px;" />
  <h2 style="font-size:20px;font-weight:600;margin:0 0 4px;">Invoice ${inv.invoiceNumber}</h2>
  <p style="color:#888;font-size:13px;margin:0 0 24px;">Status: <strong>${inv.status}</strong> &nbsp;·&nbsp; ${new Date(inv.createdAt).toLocaleDateString()}</p>
  <table>
    <tr><td style="color:#555;">Customer</td><td style="text-align:right;">${inv.customerName || inv.customerEmail || 'N/A'}</td></tr>
    <tr><td style="color:#555;">Amount</td><td style="text-align:right;font-weight:600;">${inv.amount} ${inv.currency}</td></tr>
    <tr><td style="color:#555;">Network</td><td style="text-align:right;">${network}</td></tr>
    <tr><td style="color:#555;">Tx Hash</td><td style="text-align:right;">${txHash}</td></tr>
    ${taxSection}
  </table>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
  <p style="color:#aaa;font-size:11px;">© ${new Date().getFullYear()} Invoica · invoica.ai &nbsp;·&nbsp; Invoice ID: ${inv.id}</p>
</body></html>`;
}