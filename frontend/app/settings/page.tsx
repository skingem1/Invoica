```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings - Invoica',
  description: 'Manage your account settings and preferences',
};

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account preferences and application settings.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold">General</h2>
          <p className="mt-2 text-muted-foreground">
            Configure your general account settings including profile information,
            preferences, and display options.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="mt-2 text-muted-foreground">
            Manage your notification preferences for emails, updates, and alerts
            related to your account and invoices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Billing</h2>
          <p className="mt-2 text-muted-foreground">
            Review and manage your billing information, subscription plan, and
            payment methods.
          </p>
        </section>
      </div>
    </div>
  );
}
```