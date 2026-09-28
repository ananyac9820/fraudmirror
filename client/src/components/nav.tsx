import type { ReactNode } from 'react';
import type { Role } from '../lib/types';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export interface NavItem {
  to: string;
  label: string;
  roles: Role[];
  icon: ReactNode;
}

const ALL: Role[] = ['analyst', 'redteam', 'admin'];

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', roles: ALL, icon: icon('M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z') },
  { to: '/feed', label: 'Live Feed', roles: ALL, icon: icon('M3 12h4l3-8 4 16 3-8h4') },
  { to: '/alerts', label: 'Alerts', roles: ['analyst', 'admin'], icon: icon('M12 3 2 20h20L12 3zM12 10v4M12 17.5v.5') },
  { to: '/attack-lab', label: 'Attack Lab', roles: ['redteam', 'admin'], icon: icon('M12 2v4M12 18v4M2 12h4M18 12h4M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0') },
  { to: '/loop', label: 'Loop', roles: ALL, icon: icon('M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5') },
];

export const canAccess = (path: string, role?: Role) => {
  const item = NAV.find((n) => path.startsWith(n.to));
  return !item || (!!role && item.roles.includes(role));
};
