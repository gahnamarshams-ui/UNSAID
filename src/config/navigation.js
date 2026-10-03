/**
 * Navigation Configuration
 * Defines structure for bottom bar, desktop header navigation, and view switching.
 */

export const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    iconName: 'Home',
    badge: null,
  },
  {
    id: 'activity',
    label: 'Activity',
    iconName: 'Activity',
    badge: null,
  },
  {
    id: 'create',
    label: 'Create',
    iconName: 'PlusCircle',
    isPrimaryAction: true,
    badge: null,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    iconName: 'Bell',
    badge: '3',
  },
  {
    id: 'account',
    label: 'Account',
    iconName: 'User',
    badge: null,
  },
];

export const APP_VIEWS = {
  LANDING: 'landing',
  USER_DASHBOARD: 'user-dashboard',
  ADMIN_DASHBOARD: 'admin-dashboard',
  SHOWCASE: 'showcase',
};

export const HEADER_NAV_LINKS = [
  {
    id: APP_VIEWS.LANDING,
    label: 'Preview',
    description: 'Landing showcase',
  },
  {
    id: APP_VIEWS.USER_DASHBOARD,
    label: 'User Shell',
    description: 'Future Part 3 view',
  },
  {
    id: APP_VIEWS.ADMIN_DASHBOARD,
    label: 'Admin Shell',
    description: 'Future Part 4 view',
  },
  {
    id: APP_VIEWS.SHOWCASE,
    label: 'Design System',
    description: 'Component library',
  },
];
