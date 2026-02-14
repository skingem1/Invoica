<think>
The user wants me to create a StatusBadge React component in TypeScript. Let me create a complete implementation with:

1. Proper TypeScript types for props
2. React component that accepts status and optional className
3. TailwindCSS classes for styling based on status
4. Color mapping for completed (green), pending (yellow), failed (red), processing (blue)
5. Capitalized status text
6. No external dependencies beyond React

Let me write the complete file:
</think>

```tsx
import React from "react";

type Status = "completed" | "pending" | "failed" | "processing";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusStyles: Record<Status, { bg: string; text: string }> = {
  completed: {
    bg: "bg-green-100",
    text: "text-green-800",
  },
  pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  failed: {
    bg: "bg-red-100",
    text: "text-red-800",
  },
  processing: {
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const styles = statusStyles[status];
  
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${styles.bg} ${styles.text} ${className}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default StatusBadge;
```