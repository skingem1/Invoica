import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

/**
 * Inter font configuration
 */
const inter = Inter({ subsets: ["latin"] });

/**
 * Root layout metadata
 */
export const metadata: Metadata = {
  title: "Admin Dashboard | Invoice Management",
  description:
    "Manage your invoices, track agent spending, and monitor business metrics",
  icons: {
    icon: "/favicon.ico",
  },
};

/**
 * Root layout props interface
 */
interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Root layout component that wraps the entire application
 * Provides Clerk authentication context and base styling
 * 
 * @param children - The child components to render within the layout
 * @returns The wrapped application layout with authentication provider
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0ea5e9",
          colorTextOnPrimaryBackground: "#ffffff",
          colorBackground: "#ffffff",
          colorInputBackground: "#ffffff",
          colorInputText: "#0f172a",
        },
        elements: {
          formButtonPrimary:
            "bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors",
          card: "shadow-lg border-slate-200",
        },
      }}
    >
      <html lang="en">
        <body className={`${inter.className} antialiased bg-slate-50`}>
          <div className="min-h-screen flex flex-col">
            {/* Main navigation header */}
            <header className="border-b bg-white sticky top-0 z-50">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  {/* Logo */}
                  <a href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <span className="font-semibold text-slate-900">
                      InvoiceHub
                    </span>
                  </a>

                  {/* Navigation links */}
                  <nav className="hidden md:flex items-center gap-6">
                    <a
                      href="/"
                      className="text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
                    >
                      Dashboard
                    </a>
                    <a
                      href="/invoices"
                      className="text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
                    >
                      Invoices
                    </a>
                    <a
                      href="/agents"
                      className="text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
                    >
                      Agents
                    </a>
                    <a
                      href="/settings"
                      className="text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
                    >
                      Settings
                    </a>
                  </nav>
                </div>

                {/* User menu placeholder - Clerk will inject user button */}
                <div className="flex items-center gap-4">
                  <div id="clerk-user-button" />
                </div>
              </div>
            </header>

            {/* Main content area */}
            <main className="flex-1 container mx-auto px-4 py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t bg-white py-6">
              <div className="container mx-auto px-4 text-center text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} InvoiceHub. All rights reserved.</p>
              </div>
            </footer>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
