import type { Role } from '../lib/types';

export interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

const ALL: Role[] = ['analyst', 'redteam', 'admin'];

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Overview', roles: ALL },
  { to: '/feed', label: 'Live feed', roles: ALL },
  { to: '/alerts', label: 'Alerts', roles: ['analyst', 'admin'] },
  { to: '/attack-lab', label: 'Attack lab', roles: ['redteam', 'admin'] },
  { to: '/analyze', label: 'Analyze file', roles: ALL },
];

export const canAccess = (path: string, role?: Role) => {
  const item = NAV.find((n) => path.startsWith(n.to));
  return !item || (!!role && item.roles.includes(role));
};
