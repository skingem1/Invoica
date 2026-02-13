"use client";

import { useState } from "react";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Shield, Zap, Users } from "lucide-react";

/**
 * Login page props
 */
interface LoginPageProps {
  /**
   * Search parameters from the URL
   */
  searchParams: {
    /**
     * Redirect URL after successful sign in
     */
    redirectUrl?: string;
    /**
     * Sign up URL to link to registration
     */
    signUpUrl?: string;
  };
}

/**
 * Features to display on the login page
 */
const features = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Fast Invoice Processing",
    description: "Generate and send invoices in seconds",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Agent Management",
    description: "Track and manage your sales team",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Secure Payments",
    description: "Protected transactions and data",
  },
];

/**
 * Login/Sign-in page component
 * Provides authentication using Clerk
 * 
 * @param searchParams - URL search parameters for redirect configuration
 * @returns The login page with Clerk sign-in component
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Default redirect to dashboard, or use provided redirect URL
  const redirectUrl = searchParams.redirectUrl || "/";

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding and features */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <div>
          {/* Back to home link */}
          <Link
            href="/"
            className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Link>
        </div>

        <div className="space-y-8">
          {/* Logo and tagline */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-7 h-7 text-white"
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
              <span className="text-2xl font-bold text-white">InvoiceHub</span>
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Streamline Your <br />
              <span className="text-sky-400">Invoice Management</span>
            </h1>
            <p className="mt-4 text-slate-400 text-lg max-w-md">
              Manage invoices, track payments, and monitor agent performance
              all in one place.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="p-2 bg-slate-800 rounded-lg text-sky-400">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-white font-medium">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} InvoiceHub. All rights reserved.</p>
        </div>
      </div>

      {/* Right side - Sign in form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-white"
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
            <span className="text-xl font-bold text-slate-900">InvoiceHub</span>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 mt-2">
              Sign in to your account to continue
            </p>
          </div>

          {/* Clerk SignIn component */}
          <div className="flex justify-center">
            <SignIn
              routing="hash"
              signUpUrl={`/register?redirect_url=${encodeURIComponent(redirectUrl)}`}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border border-slate-200 rounded-lg",
                  formButtonPrimary:
                    "bg-sky-500 hover:bg-sky-600 text-white font-medium py-2.5 px-4 rounded-md transition-colors",
                  formFieldInput:
                    "border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500",
                  footerActionLink: "text-sky-600 hover:text-sky-700",
                  dividerLine: "bg-slate-200",
                  dividerText: "text-slate-500",
                  identityPreviewText: "text-slate-600",
                  identityPreviewEditButton: "text-sky-600",
                  formFieldLabel: "text-slate-700 font-medium",
                  formFieldInputShowPasswordButton: "text-slate-500",
                },
              }}
            />
          </div>

          {/* Help text */}
          <p className="text-center text-sm text-slate-500">
            Having trouble signing in?{" "}
            <a
              href="mailto:support@invoicehub.com"
              className="text-sky-600 hover:text-sky-700 font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
