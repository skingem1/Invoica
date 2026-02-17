'use client';

import React from 'react';

export default function DashboardApiKeysPage() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          + Create Key
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200">
              <td className="px-6 py-4 whitespace-nowrap text-sm">Production</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">inv_live_****7f3a</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">Jan 15, 2026</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-red-600 text-sm hover:underline">Revoke</button>
              </td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="px-6 py-4 whitespace-nowrap text-sm">Staging</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">inv_test_****2b1c</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">Feb 1, 2026</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-red-600 text-sm hover:underline">Revoke</button>
              </td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="px-6 py-4 whitespace-nowrap text-sm">Legacy</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">inv_live_****9e4d</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">Dec 1, 2025</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Revoked</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}