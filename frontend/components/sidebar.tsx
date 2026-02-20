'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { navItems, type NavItem } from './sidebar-nav-items';

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <svg className={`w-5 h-5 transition-colors duration-200 ${active ? 'text-[#635BFF]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
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
    <aside className="fixed left-0 top-16 bottom-0 w-16 md:w-56 bg-white border-r border-gray-100 z-40 overflow-y-auto">
      <nav className="py-4" aria-label="Sidebar navigation">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-[#635BFF]/[0.08] text-[#635BFF] shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="flex-shrink-0"><NavIcon item={item} active={active} /></span>
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
