'use client';

import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Paused';
}

const initialAgents: Agent[] = [
  {
    id: '1',
    name: 'Invoice Processor',
    role: 'Automatically extracts and categorizes invoice data from uploaded documents',
    status: 'Active',
  },
  {
    id: '2',
    name: 'Payment Monitor',
    role: 'Tracks payment statuses and sends reminders for overdue invoices',
    status: 'Active',
  },
  {
    id: '3',
    name: 'Analytics Agent',
    role: 'Generates spending insights and forecasts cash flow trends',
    status: 'Active',
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === 'Active' ? 'Paused' : 'Active' }
          : a
      )
    );
  };

  const restartAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Active' } : a))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor and manage the AI agents that automate your invoicing workflows.
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
                className={}
              >
                {agent.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{agent.role}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => toggleAgent(agent.id)}
                className={}
              >
                {agent.status === 'Active' ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={() => restartAgent(agent.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                Restart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
