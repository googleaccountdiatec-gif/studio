# **App Name**: KPI Insights

## Core Features:
Modular KPI Dashboards:

CAPA (Corrective and Preventive Actions):

Import CAPA data from CSV/TSV files with robust, flexible parsing.

Smart Deadlines: Automatically calculate overdue CAPAs based on 'Due Date' and 'Deadline for effectiveness check', utilizing phase-aware logic to prevent false alarms.

Dynamic Filtering: Filter CAPAs by time-frame, completion status, operational phase (Execution vs. Effectiveness), and team contexts.

High-Contrast Visualization: Interactive charts utilizing the Pink vs. Black data series for immediate status recognition.

Interactive Drill-Downs: Clickable chart segments reveal detailed data in frosted-glass overlays.

Data Grid: Detailed data table with customizable column visibility and "pilled" status badges.

AI Executive Summary: AI-powered summarization to provide the "tea" on the current CAPA landscape.

Change Action:

Robust CSV/TSV import for Change Action data.

completion status and team filtering.

Trend Analysis: Interactive charts for monthly registrations and actions, grouped by Change ID using the primary and secondary theme colors.

Deep Dive: Clickable charts to drill down into specific Change ID details.

Active Action Monitor: Comprehensive data table displaying active actions, with overdue items highlighted using the semantic --destructive (Soft Red) color for urgency without aggression.

Non-conformance:

Import Non-conformance data with historical comparison capabilities.

Year-over-Year View: Filter data by Current vs. Previous Year.

Quarterly Risk Visuals: Interactive charts displaying:

Risk & Total Volume (Low Risk/High Risk/Total).

Reoccurrence Trends.

Clickable drill-down interactions.

Centralized Settings:

A dedicated "Settings" tab wrapped in a glass-effect container.

Team Management: View and edit "Production Team" members with persistence via local storage.

Aesthetic Control: Selectable color palettes with live preview swatches:

Light: (Clean White/Blue/Gold)

Dark: (High Contrast Navy/White)

Rose: (Soft Blush/Hot Pink/Ink Black)

Slate: (Muted Grey/Indigo/Gunmetal)

Unified Interface:

Glassmorphism Navigation: Tabbed navigation floating on a blurred background to seamlessly switch between modules.

Header: Minimalist, centralized header with the application title.

Style Guidelines:
Design Philosophy: "Modern Hyper-Femininity." A balance of soft, approachable backgrounds with dominant, high-contrast data visualization.

Primary Palette (Theme Dependent):

Rose Mode: Hot Pink (#E11D48) for primary actions and active states, signaling energy and passion.

Slate/Dark Mode: Soft Indigo (#687CEB) or Stark White for readability in low-light environments.

Backgrounds:

Moving away from flat grey. We utilize Tinted Surfaces:

Rose: A very pale blush (#FFECF1) to reduce eye strain while maintaining aesthetic.

Dark: Deep Obsidian (#0F172A) for maximum "Dark Mode" comfort.

Accents & Data Visualization:

The "Power" Accent: Deep Ink Black (#171717) creates a stark, fashionable contrast against the pink primary.

Status Colors:

Overdue: Soft Red (--destructive) rather than aggressive alarmist red.

Secondary Data: Teal (#0D9488) or Gold (#EAB308) for chart segments to differentiate from the Pink/Black dominance.

UI Patterns: Glassmorphism:

Cards: Data containers use a frosted glass effect (bg-card/40 + backdrop-blur-md) with subtle white borders (border-white/20) to create depth and hierarchy.

Shadows: Soft, diffuse shadows (shadow-xl) to lift glass elements off the background.

Typography:

Font: 'Inter' (Sans-serif).

Weights: Heavy use of Bold headings to contrast against the airy, transparent backgrounds.

Interaction:

Hover States: Elements gently lift or increase in opacity when interacted with.

Transitions: Smooth ease-in-out transitions for all color and layout changes.