import React from "react";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "Active" | "Inactive" | "Paused";
}

const agents: Agent[] = [
  {
    id: "1",
    name: "Invoice Processor",
    role: "Automatically extracts and categorizes invoice data from uploaded documents",
    status: "Active",
  },
  {
    id: "2",
    name: "Payment Monitor",
    role: "Tracks payment statuses and sends reminders for overdue invoices",
    status: "Active",
  },
  {
    id: "3",
    name: "Analytics Agent",
    role: "Generates spending insights and forecasts cash flow trends",
    status: "Active",
  },
];

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor and manage the AI agents that automate your invoicing workflows.
          Each agent operates continuously to process, track, and analyze your financial data.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-semibold">{agent.name}</h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  agent.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : agent.status === "Paused"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {agent.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{agent.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
