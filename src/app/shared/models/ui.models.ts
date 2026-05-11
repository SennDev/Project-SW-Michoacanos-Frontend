import { UserRole } from './auth.models';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: UserRole[];
  description: string;
}

export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T & string;
  header: string;
  formatter?: (row: T) => string | number;
  badge?: (row: T) => string;
  className?: string;
}

export interface ChartPoint {
  label: string;
  value: number;
  color?: string;
}

export interface KpiCard {
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}
