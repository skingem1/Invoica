'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { navItems, type NavItem } from './sidebar-nav-items';

function NavIcon({ item }: { item: NavItem }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
      {item.iconPaths?.map((p, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />
      ))}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-16 md:w-56 bg-white border-r border-slate-200 z-40 overflow-y-auto">
      <nav className="py-4" aria-label="Sidebar navigation">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="flex-shrink-0"><NavIcon item={item} /></span>
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
