<think>
The user wants me to create a complete invoice list page for the admin dashboard. Let me analyze the requirements and fix all the issues from the previous attempt:

1. **Complete the file** - it was cut off mid-function
2. **Add main component export** - InvoicesPage component
3. **Add JSX return statement** - complete component render logic
4. **Add search functionality** - filter by invoice number or customer name
5. **Implement pagination** - use ChevronLeft, ChevronRight
6. **Add error handling** - error boundaries
7. **Add JSDoc documentation** - on utility functions

Let me create a complete, production-quality invoice list page with:
- shadcn/ui Table component
- Mock data (5 sample invoices)
- Search bar
- Status badges with colors
- Sorting
- Pagination
- Responsive design
- Error handling

I'll use the proper imports from shadcn/ui components and implement all the required functionality.
</think>

```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Search, ArrowUpDown } from "lucide-react";

/**
 * Invoice status types with corresponding display labels and colors
 */
type InvoiceStatus = "completed" | "pending" | "failed" | "processing";

/**
 * Invoice data interface representing a single invoice record
 */
interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
}

/**
 * Mock invoice data for demonstration purposes
 */
const MOCK_INVOICES: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-001",
    customer: "Acme Corporation",
    amount: 1250.00,
    status: "completed",
    date: "2024-01-15",
  },
  {
    id: "2",
    invoiceNumber: "INV-002",
    customer: "Tech Solutions Inc",
    amount: 3400.50,
    status: "pending",
    date: "2024-01-18",
  },
  {
    id: "3",
    invoiceNumber: "INV-003",
    customer: "Global Industries",
    amount: 890.00,
    status: "failed",
    date: "2024-01-20",
  },
  {
    id: "4",
    invoiceNumber: "INV-004",
    customer: "Smith & Partners",
    amount: 2100.00,
    status: "processing",
    date: "2024-01-22",
  },
  {
    id: "5",
    invoiceNumber: "INV-005",
    customer: "Quantum Dynamics",
    amount: 5670.25,
    status: "completed",
    date: "2024-01-25",
  },
];

/**
 * Format currency amount to USD string
 * @param amount - Numeric amount to format
 * @returns Formatted currency string
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

/**
 * Format date string to locale-friendly format
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Get status badge color variant based on invoice status
 * @param status - Invoice status
 * @returns Badge variant string
 */
const getStatusVariant = (status: InvoiceStatus): "default" | "destructive" | "secondary" | "outline" => {
  const variants: Record<InvoiceStatus, "default" | "destructive" | "secondary" | "outline"> = {
    completed: "default",
    pending: "secondary",
    failed: "destructive",
    processing: "outline",
  };
  return variants[status];
};

/**
 * Get CSS classes for status badge background
 * @param status - Invoice status
 * @returns Tailwind CSS classes
 */
const getStatusColorClass = (status: InvoiceStatus): string => {
  const colors: Record<InvoiceStatus, string> = {
    completed: "bg-green-500 hover:bg-green-600",
    pending: "bg-yellow-500 hover:bg-yellow-600",
    failed: "bg-red-500 hover:bg-red-600",
    processing: "bg-blue-500 hover:bg-blue-600",
  };
  return colors[status];
};

/**
 * Sort direction type
 */
type SortDirection = "asc" | "desc";

/**
 * Main InvoicesPage component - displays a table of invoices with search, sort, and pagination
 */
export default function InvoicesPage() {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<keyof Invoice>("invoiceNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Error state for boundary handling
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle search input change
   * @param event - Input change event
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1); // Reset to first page on search
  }, []);

  /**
   * Handle column header click for sorting
   * @param column - Column key to sort by
   */
  const handleSort = useCallback((column: keyof Invoice) => {
    setSortDirection((prev) => {
      if (sortColumn === column) {
        return prev === "asc" ? "desc" : "asc";
      }
      return "asc";
    });
    setSortColumn(column);
  }, [sortColumn]);

  /**
   * Filter and sort invoices based on search query and sort settings
   */
  const filteredInvoices = useMemo(() => {
    try {
      let result = [...MOCK_INVOICES];

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(
          (invoice) =>
            invoice.invoiceNumber.toLowerCase().includes(query) ||
            invoice.customer.toLowerCase().includes(query)
        );
      }

      // Apply sorting
      result.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });

      return result;
    } catch (err) {
      setError("Failed to filter invoices. Please try again.");
      return [];
    }
  }, [searchQuery, sortColumn, sortDirection]);

  /**
   * Calculate pagination values
   */
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + itemsPerPage);

  /**
   * Handle previous page navigation
   */
  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  /**
   * Handle next page navigation
   */
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  /**
   * Handle view invoice action
   * @param id - Invoice ID
   */
  const handleViewInvoice = useCallback((id: string) => {
    console.log("View invoice:", id);
    // In a real app, this would navigate to the invoice detail page
    // router.push(`/invoices/${id}`);
  }, []);

  // Error state display
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="text-red-500 text-center">
              <p className="text-lg font-semibold">Error</p>
              <p>{error}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setError(null)}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Invoices</CardTitle>
          <CardDescription>
            Manage and view all your invoices in one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number or customer..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("invoiceNumber")}
                  >
                    <div className="flex items-center gap-2">
                      Invoice Number
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("customer")}
                  >
                    <div className="flex items-center gap-2">
                      Customer
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center gap-2">
                      Amount
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>{invoice.customer}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <Badge 
                          className={`${getStatusColorClass(invoice.status)} text-white`}
                          variant={getStatusVariant(invoice.status)}
                        >
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.date)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredInvoices.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```