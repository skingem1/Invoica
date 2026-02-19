/**
 * Represents a single invoice record.
 */
export interface Invoice {
  /** Unique identifier for the invoice */
  id: string;
  /** Human-readable invoice number */
  invoiceNumber: string;
  /** Alias used by some components */
  number?: string;
  /** Invoice amount in the specified currency */
  amount: number;
  /** ISO 4217 currency code (e.g., USD, EUR) */
  currency: string;
  /** Current status of the invoice */
  status: string;
  /** Timestamp when the invoice was created */
  createdAt: string;
  /** Timestamp when the invoice was paid */
  paidAt?: string | null;
  /** Arbitrary metadata attached to the invoice */
  metadata?: Record<string, string>;
}

/**
 * Response from the invoices list API endpoint.
 */
export interface InvoiceListResponse {
  /** Array of invoice records */
  invoices: Invoice[];
  /** Current pagination state */
  pagination: {
    /** Total number of invoices matching the query */
    total: number;
    /** Current page number (1-indexed) */
    page: number;
    /** Number of items per page */
    limit: number;
    /** Total number of pages available */
    totalPages: number;
  };
}
