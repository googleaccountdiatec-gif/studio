# **App Name**: KPI Insights

## Core Features:

- **Modular KPI Dashboards:**
  - **CAPA (Corrective and Preventive Actions):**
    - Import CAPA data from CSV/TSV files with robust, flexible parsing.
    - Automatically calculate overdue CAPAs based on 'Due Date' and 'Deadline for effectiveness check', with phase-aware logic.
    - Filter CAPAs by time-frame, completion status, operational phase (Execution vs. Effectiveness), and team (Production Only vs. All).
    - Interactive data visualizations, including charts for CAPA status and distribution by assignee.
    - Clickable charts to drill down into specific data segments (e.g., view all CAPAs for a selected assignee).
    - Detailed data table with customizable column visibility.
    - AI-powered summarization of the current CAPA landscape.
  - **Change Action:**
    - Import Change Action data from CSV/TSV files with robust parsing.
    - Filter actions by completion status and team (Production Only vs. All).
    - Interactive charts for monthly registrations and actions grouped by Change ID.
    - Clickable charts to drill down into the details of a specific Change ID.
    - Comprehensive data table displaying all active actions, with overdue items highlighted.
  - **Non-conformance:**
    - Placeholder for importing, visualizing, and analyzing Non-conformance data.

- **Centralized Settings:**
  - A dedicated "Settings" tab to manage application-wide configurations.
  - View the current list of "Production Team" members (editing functionality planned).

- **Unified Interface:**
  - Tabbed navigation to seamlessly switch between different KPI modules.
  - Centralized header with the application title, "KPI Insights".

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust and stability, fitting for professional data visualization.
- Background color: Light grey (#ECEFF1), subtly tinted blue, to maintain focus on the data.
- Accent color: Soft orange (#FFAB40) for highlighting overdue CAPAs, drawing attention without overwhelming.
- Body and headline font: 'Inter', a sans-serif, will be used for all text. This is suitable for all headlines and body text
- Use simple, geometric icons to represent different aspects of KPI data.
- A clean, card-based layout to present KPIs and data points in an organized manner.
- Subtle animations to show loading states and transitions, improving user experience without being distracting.
