import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";

/**
 * Dashboard statistics interface
 */
interface DashboardStat {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  href: string;
}

/**
 * Recent activity item interface
 */
interface RecentActivity {
  id: string;
  type: "invoice" | "payment" | "agent";
  title: string;
  description: string;
  timestamp: string;
  status: "success" | "pending" | "failed";
}

/**
 * Mock dashboard statistics data
 */
const stats: DashboardStat[] = [
  {
    title: "Total Invoices",
    value: "1,248",
    description: "All time invoices generated",
    icon: <FileText className="h-5 w-5 text-sky-600" />,
    trend: { value: "+12.5%", isPositive: true },
    href: "/invoices",
  },
  {
    title: "Pending",
    value: "34",
    description: "Awaiting payment",
    icon: <Clock className="h-5 w-5 text-amber-600" />,
    trend: { value: "-8.2%", isPositive: true },
    href: "/invoices?status=pending",
  },
  {
    title: "Paid",
    value: "$84,320",
    description: "Revenue this month",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    trend: { value: "+23.1%", isPositive: true },
    href: "/invoices?status=paid",
  },
  {
    title: "Overdue",
    value: "12",
    description: "Require attention",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    trend: { value: "+4.3%", isPositive: false },
    href: "/invoices?status=overdue",
  },
];

/**
 * Mock recent activity data
 */
const recentActivity: RecentActivity[] = [
  {
    id: "1",
    type: "invoice",
    title: "Invoice #INV-1248",
    description: "Created for Acme Corp",
    timestamp: "2 minutes ago",
    status: "pending",
  },
  {
    id: "2",
    type: "payment",
    title: "Payment Received",
    description: "$4,500 from Tech Solutions Inc",
    timestamp: "15 minutes ago",
    status: "success",
  },
  {
    id: "3",
    type: "agent",
    title: "Agent Assignment",
    description: "John Doe assigned to Invoice #INV-1245",
    timestamp: "1 hour ago",
    status: "success",
  },
  {
    id: "4",
    type: "invoice",
    title: "Invoice #INV-1247",
    description: "Sent to Global Industries",
    timestamp: "2 hours ago",
    status: "pending",
  },
  {
    id: "5",
    type: "payment",
    title: "Payment Failed",
    description: "Retry scheduled for Invoice #INV-1240",
    timestamp: "3 hours ago",
    status: "failed",
  },
];

/**
 * Get status badge color based on activity status
 * 
 * @param status - The status of the activity
 * @returns Tailwind CSS classes for the badge
 */
function getStatusBadgeClasses(status: RecentActivity["status"]): string {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "failed":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/**
 * Dashboard home page component
 * Displays key metrics, recent activity, and quick actions
 * 
 * @returns The dashboard page with stats cards and activity feed
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your invoices.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/invoices">
              <TrendingUp className="h-4 w-4 mr-2" />
              View Reports
            </Link>
          </Button>
          <Button asChild>
            <Link href="/invoices/new">
              <FileText className="h-4 w-4 mr-2" />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {stat.title}
              </CardTitle>
              <div className="p-2 rounded-lg bg-slate-50">{stat.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {stat.value}
              </div>
              <p className="text-xs text-slate-500 mt-1">{stat.description}</p>
              {stat.trend && (
                <div
                  className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                    stat.trend.isPositive ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {stat.trend.isPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 rotate-90" />
                  )}
                  {stat.trend.value} from last month
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick stats row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-600" />
              Active Agents
            </CardTitle>
            <CardDescription>Performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900">24</p>
                <p className="text-sm text-slate-500 mt-1">Online now</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-900">156</p>
                <p className="text-sm text-slate-500 mt-1">Total agents</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: "15%" }} />
              </div>
              <p className="text-xs text-slate-500 mt-2">15% of agents currently active</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-sky-600" />
              Revenue Overview
            </CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900">$127,450</p>
                <p className="text-sm text-slate-500 mt-1">Total revenue</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">98.2%</p>
                <p className="text-sm text-slate-500 mt-1">Collection rate</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/invoices">View All Invoices</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/reports">Download Report</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest updates from your account</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/activity" className="text-sky-600 hover:text-sky-700">
                View All
                <ArrowUpRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    activity.status === "success"
                      ? "bg-emerald-500"
                      : activity.status === "pending"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 truncate">
                      {activity.title}
                    </p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {activity.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {activity.description}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
                    activity.status
                  )}`}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
