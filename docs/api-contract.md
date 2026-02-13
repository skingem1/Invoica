# API Contract

## Invoice API

### POST /api/invoices
Create a new invoice.

Request: { amount, currency, buyer: { companyName, address, vat, email }, seller: { name, address, vat, wallet } }
Response: { id, invoiceNumber, status, total }

### GET /api/invoices/:id
Get invoice by ID.

### GET /api/invoices
List invoices with filters: status, startDate, endDate, agentId

## Tax API

### POST /api/tax/calculate
Calculate tax for a transaction.

## Budget API

### POST /api/budget/check
Check if agent can spend amount.

### GET /api/budget/:agentId
Get agent budget status.
