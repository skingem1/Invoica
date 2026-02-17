import { navItems } from '../sidebar-nav-items';

const EXPECTED_LABELS = ['Dashboard', 'Settlements', 'API Keys', 'Invoices', 'Settings', 'Agents', 'Webhooks', 'Docs'];

describe('sidebar-nav-items', () => {
  it('navItems is an array with exactly 8 items', () => {
    expect(Array.isArray(navItems)).toBe(true);
    expect(navItems).toHaveLength(8);
  });

  it('each item has required properties with valid values', () => {
    navItems.forEach((item) => {
      expect(item).toHaveProperty('href');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('iconPath');
      expect(typeof item.href).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(typeof item.iconPath).toBe('string');
      expect(item.iconPath.length > 0).toBe(true); // non-empty string per spec
    });
  });

  it('href values are unique and start with /', () => {
    const hrefs = navItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(8);
    hrefs.forEach((href) => expect(href.startsWith('/')).toBe(true));
  });

  it('label values are unique and match expected set', () => {
    const labels = navItems.map((item) => item.label);
    expect(new Set(labels).size).toBe(8);
    expect(labels).toEqual(expect.arrayContaining(EXPECTED_LABELS));
  });

  it('Settings item has iconPaths array', () => {
    const settings = navItems.find((item) => item.label === 'Settings');
    expect(settings).toBeDefined();
    expect(settings!.iconPaths).toBeDefined();
    expect(Array.isArray(settings!.iconPaths)).toBe(true);
  });

  it('first item is Dashboard with href / and last is Docs with href /docs/getting-started', () => {
    expect(navItems[0].label).toBe('Dashboard');
    expect(navItems[0].href).toBe('/');
    expect(navItems[7].label).toBe('Docs');
    expect(navItems[7].href).toBe('/docs/getting-started');
  });
});