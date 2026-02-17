export default function BillingPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Billing</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
        <div className="border rounded-lg p-6 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold">Free Plan</h3>
            <p className="text-gray-500">Up to 100 invoices/month</p>
          </div>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            Active
          </span>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Usage This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">Invoices Created</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">0</span>
              <span className="text-gray-400">/ 100</span>
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">API Calls</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">0</span>
              <span className="text-gray-400">/ 10,000</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
        <div className="border rounded-lg p-6">
          <p className="text-gray-500 text-center">No payment method on file</p>
          <button className="text-blue-600 hover:underline block mx-auto mt-2">
            Add payment method
          </button>
        </div>
      </section>
    </div>
  );
}