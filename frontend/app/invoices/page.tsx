<think>
The user wants me to create a complete, production-quality invoice list page at `frontend/app/invoices/page.tsx`. I need to address all the issues mentioned:

1. Fix incomplete sort function
2. Use shadcn/ui components properly
3. Add error handling
4. Add accessibility attributes
5. Implement currency formatting
6. Implement date formatting
7. Add loading states and empty states
8. Use sort indicator icons

Let me create a complete, working implementation:

- Use shadcn/ui Table, Badge, Button, Input components
- Add proper TypeScript types
- Create mock data
- Implement search/filter functionality
- Implement sorting with proper indicators
- Format currency and dates
- Add accessibility attributes
- Handle loading and empty states
- Make it responsive

I'll assume the shadcn/ui components are available at @/components/ui/ as mentioned in the requirements.
</think>

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  Eye
} from "lucide-react";

// Types
type InvoiceStatus = "completed" | "pending" | "failed" | "processing";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
}

// Mock data
const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-001",
    customer: "Acme Corporation",
    amount: 1250.00,
    status: "completed",
    date: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    invoiceNumber: "INV-002",
    customer: "Tech Solutions Inc.",
    amount: 3450.50,
    status: "pending",
    date: "2024-01-16T14:20:00Z",
  },
  {
    id: "3",
    invoiceNumber: "INV-003",
    customer: "Global Ventures",
    amount: 890.00,
    status: "failed",
    date: "2024-01-17T09:15:00Z",
  },
  {
    id: "4",
    invoiceNumber: "INV-004",
    customer: "Smith & Associates",
    amount: 2100.75,
    status: "processing",
    date: "2024-01-18T16:45:00Z",
  },
  {
    id: "5",
    invoiceNumber: "INV-005",
    customer: "Innovate Labs",
    amount: 567.25,
    status: "completed",
    date: "2024-01-19T11:00:00Z",
  },
];

type SortField = "invoiceNumber" | "customer" | "amount" | "status" | "date";
type SortDirection = "asc" | "desc";

// Status badge variant mapping
const statusVariantMap: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  pending: "secondary",
  failed: "destructive",
  processing: "outline",
};

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

// Format date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
};

// Sort function
const sortInvoices = (
  invoices: Invoice[], 
  field: SortField, 
  direction: SortDirection
): Invoice[] => {
  return [...invoices].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case "invoiceNumber":
      case "customer":
        comparison = a[field].localeCompare(b[field]);
        break;
      case "amount":
        comparison = a.amount - b.amount;
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      case "date":
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
    }
    
    return direction === "asc" ? comparison : -comparison;
  });
};

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(false);

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    setIsLoading(true);
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    // Simulate loading for better UX
    setTimeout(() => setIsLoading(false), 150);
  }, [sortField]);

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    try {
      let result = [...mockInvoices];
      
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        result = result.filter(
          (invoice) =>
            invoice.invoiceNumber.toLowerCase().includes(query) ||
            invoice.customer.toLowerCase().includes(query)
        );
      }
      
      // Sort
      return sortInvoices(result, sortField, sortDirection);
    } catch (error) {
      console.error("Error filtering/sorting invoices:", error);
      return mockInvoices;
    }
  }, [searchQuery, sortField, sortDirection]);

  // Get sort icon for column
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <div className="flex flex-col ml-1 w-3 h-3 opacity-30">
          <ChevronUp className="h-2 w- -mb-1" />
          <ChevronDown className="h-2 w-" />
        </div>
      );
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 w-3 h-3" />
    ) : (
      <ChevronDown className="ml-1 w-3 h-3" />
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
        <p className="text-muted-foreground mt-1">
          Manage and view all your invoices in one place.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by invoice number or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            aria-label="Search invoices"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("invoiceNumber")}
                aria-label="Sort by invoice number"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSort("invoiceNumber")}
              >
                <div className="flex items-center">
                  Invoice Number
                  {getSortIcon("invoiceNumber")}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("customer")}
                aria-label="Sort by customer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSort("customer")}
              >
                <div className="flex items-center">
                  Customer
                  {getSortIcon("customer")}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("amount")}
                aria-label="Sort by amount"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSort("amount")}
              >
                <div className="flex items-center justify-end">
                  Amount
                  {getSortIcon("amount")}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
                aria-label="Sort by status"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSort("status")}
              >
                <div className="flex items-center">
                  Status
                  {getSortIcon("status")}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("date")}
                aria-label="Sort by date"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSort("date")}
              >
                <div className="flex items-center">
                  Date
                  {getSortIcon("date")}
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    <span>Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAndSortedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8" />
                    <p>No invoices found</p>
                    {searchQuery && (
                      <Button 
                        variant="link" 
                        onClick={() => setSearchQuery("")}
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>{invoice.customer}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(invoice.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariantMap[invoice.status]}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(invoice.date)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      asChild
                    >
                      <Link 
                        href={`/invoices/${invoice.id}`}
                        aria-label={`View invoice ${invoice.invoiceNumber}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Info */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {filteredAndSortedInvoices.length} of {mockInvoices.length} invoices
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```