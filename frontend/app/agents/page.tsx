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

function getToggleClass(status: string) {
  if (status === 'Active') {
    return 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100';
  }
  return 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100';
}

function getStatusClass(status: string) {
  if (status === 'Active') return 'bg-green-100 text-green-800';
  if (status === 'Paused') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-800';
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === 'Active' ? 'Paused' as const : 'Active' as const }
          : a
      )
    );
  };

  const restartAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Active' as const } : a))
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
                className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' + getStatusClass(agent.status)}
              >
                {agent.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{agent.role}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => toggleAgent(agent.id)}
                className={'px-3 py-1.5 text-xs font-medium rounded-md transition-colors ' + getToggleClass(agent.status)}
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
