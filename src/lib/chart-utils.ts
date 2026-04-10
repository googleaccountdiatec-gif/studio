/**
 * Shared chart configuration utilities.
 * Centralizes tooltip styling, semantic colors, and date formatting for charts.
 */

/** Standard Recharts tooltip content style for all dashboards */
export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'hsl(var(--card))',
  borderRadius: '8px',
  backdropFilter: 'blur(4px)',
  border: '1px solid hsl(var(--border))',
};

/**
 * Semantic status colors for chart bars/segments.
 * Use these instead of --chart-N variables when coloring by status meaning.
 */
export const STATUS_COLORS = {
  completed: 'hsl(160 60% 45%)',     // Teal-green (matches Completed badges)
  onTime: 'hsl(142 76% 36%)',        // Green
  overdue: 'hsl(0 84% 60%)',         // Red (matches destructive)
  pending: 'hsl(35 90% 60%)',        // Amber (matches pending badges)
  lowRisk: 'hsl(35 90% 60%)',        // Amber — manageable, not alarming
  highRisk: 'hsl(0 84% 60%)',        // Red — danger
  neutral: 'hsl(var(--primary))',     // Theme primary for totals/aggregates
} as const;
