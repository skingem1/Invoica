import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Sidebar } from "@/components/sidebar";
import Image from "next/image";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invoica — Financial OS for AI Agents",
  description:
    "Manage your invoices, track agent spending, and monitor business metrics",
  icons: {
    icon: "/favicon.ico",
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#635BFF",
          colorTextOnPrimaryBackground: "#ffffff",
          colorBackground: "#ffffff",
          colorInputBackground: "#ffffff",
          colorInputText: "#0A2540",
        },
        elements: {
          formButtonPrimary:
            "bg-[#635BFF] hover:bg-[#635BFF]/90 text-white font-medium transition-colors",
          card: "shadow-lg border-slate-200",
        },
      }}
    >
      <html lang="en">
        <body className={`${inter.className} antialiased bg-slate-50`}>
          <div className="min-h-screen flex flex-col">
            <header className="border-b bg-white sticky top-0 z-50">
              <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <a href="/" className="flex items-center gap-2">
                    <Image
                      src="/logo.png"
                      alt="Invoica"
                      width={160}
                      height={44}
                      className="h-11 w-auto"
                      priority
                    />
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <a
                    href="https://docs.invoica.ai"
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden md:inline"
                  >
                    Docs
                  </a>
                  <div id="clerk-user-button" />
                </div>
              </div>
            </header>

            <div className="flex-1 flex">
              <Sidebar />
              <main className="flex-1 ml-16 md:ml-56 p-6">
                {children}
              </main>
            </div>

            <footer className="border-t bg-white py-6 ml-16 md:ml-56">
              <div className="px-6 text-center text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} Invoica. All rights reserved.</p>
              </div>
            </footer>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
