<think>
The user wants me to create an invoice list page for the admin dashboard. Let me break down the requirements:

1. File: app/invoices/page.tsx
2. Display a table of invoices with columns:
   - Invoice Number
   - Customer
   - Amount
   - Status (with colored badges: green=completed, yellow=pending, red=failed, blue=processing)
   - Date
   - Actions (view button)
3. Use shadcn/ui Table component
4. Include mock data (5 sample invoices)
5. Add a search bar at the top to filter by invoice number or customer name
6. Use TailwindCSS for styling
7. Make it responsive

Since this is a Next.js 14 app with shadcn/ui, I need to use their components. The user mentioned using shadcn/ui Table component, so I'll need to import from @/components/ui/table.

Let me create a complete, production-quality page with:
- Proper TypeScript types
- Mock data
- Search functionality
- Responsive design
- Status badges with appropriate colors

I'll use the shadcn/ui components:
- Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- Badge for status badges
- Button for actions
- Input for search

Let me write the code:
</think>

```tsx
"use client";

import { useState, useMemo } from "react";
import { Eye, Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InvoiceStatus = "completed" | "pending" | "failed" | "processing";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
}

const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-001",
    customer: "Acme Corporation",
    amount: 12500.0,
    status: "completed",
    date: "2024-01-15",
  },
  {
    id: "2",
    invoiceNumber: "INV-002",
    customer: "TechStart Inc.",
    amount: 8750.5,
    status: "pending",
    date: "2024-01-18",
  },
  {
    id: "3",
    invoiceNumber: "INV-003",
    customer: "Global Solutions Ltd.",
    amount: 23400.0,
    status: "failed",
    date: "2024-01-20",
  },
  {
    id: "4",
    invoiceNumber: "INV-004",
    customer: "Smith & Associates",
    amount: 5600.75,
    status: "processing",
    date: "2024-01-22",
  },
  {
    id: "5",
    invoiceNumber: "INV-005",
    customer: "Innovate Tech",
    amount: 18900.25,
    status: "completed",
    date: "2024-01-25",
  },
];

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20" },
  pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20" },
  processing: { label: "Processing", className: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20" },
};

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Invoice>("invoiceNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredAndSortedInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = mockInvoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.customer.toLowerCase().includes(query);
      return matchesSearch;
    });

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  }, [searchQuery, sortField, sortDirection]);

  const handleSort = (field: keyof Invoice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: keyof Invoice }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-2 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-2 h-4 w-4" />
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleViewInvoice = (id: string) => {
    console.log("View invoice:", id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage and view all your invoices
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("invoiceNumber")}
              >
                <div className="flex items-center">
                  Invoice Number
                  <SortIcon field="invoiceNumber" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("customer")}
              >
                <div className="flex items-center">
                  Customer
                  <SortIcon field="customer" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end">
                  Amount
                  <SortIcon field="amount" />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center">
                  Date
                  <SortIcon field="date" />
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>{invoice.customer}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusConfig[invoice.status].className}
                    >
                      {statusConfig[invoice.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(invoice.date)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewInvoice(invoice.id)}
                      aria-label={`View invoice ${invoice.invoiceNumber}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedInvoices.length} of {mockInvoices.length} invoices
      </div>
    </div>
  );
}
```