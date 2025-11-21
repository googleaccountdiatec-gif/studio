# **App Name**: KPI Insights

## Core Features:

- **Modular KPI Dashboards:**
  - **Total Overview (Compendium):**
    - **Executive Summary:** Aggregates critical metrics from all other modules into a single view.
    - **NC Trends:** Displays quarterly Non-conformance risk/volume and reoccurrence trends (Current & Previous Year).
    - **Unified Overdue Chart:** Compares overdue items across CAPA (Execution & Effectiveness), Change Actions, and Training.
    - **Team Filtering:** "Production Only" filter applies to all overdue metrics.
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
    - Import Non-conformance data from CSV/TSV files with robust parsing.
    - Filter data by year (Current vs. Previous, All Time).
    - Interactive charts displaying quarterly data for:
        - Risk & Total Volume (Low Risk, High Risk, Total).
        - Reoccurrence Trend.
    - Clickable charts to drill down into the specific NCs for a selected data point.
  - **Training & Competence:**
    - Import Training KPI data from CSV/TSV files.
    - Dashboard featuring "Glassmorphism" design for high visual impact.
    - Top-level stats for Total Assignments, Completion Rate (Radial Chart), and Overdue List.
    - "Training Overview" bar chart showing completed vs. pending training per trainee.
    - "Department Vibe Check" pie chart showing the breakdown of training categories.
    - Detailed "Call Out List" table with status badges (Slay, WIP, Late!) and tooltips for pending steps.
    
- **Centralized Settings:**
  - A dedicated "Settings" tab to manage application-wide configurations.
  - View and edit the list of "Production Team" members with changes saved to local storage.
  - Selectable color palettes (Light, Dark, Rose, Slate) to customize the application's appearance.

- **Unified Interface:**
  - Tabbed navigation to seamlessly switch between different KPI modules.
  - Centralized header with the application title, "KPI Insights".
  - Smart Multi-File Uploader in the header that automatically identifies and parses files for all modules.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust and stability, fitting for professional data visualization.
- Background color: Light grey (#ECEFF1), subtly tinted blue, to maintain focus on the data.
- Accent color: Soft orange (#FFAB40) for highlighting overdue CAPAs, drawing attention without overwhelming.
- Body and headline font: 'Inter', a sans-serif, will be used for all text. This is suitable for all headlines and body text
- Use simple, geometric icons to represent different aspects of KPI data.
- A clean, card-based layout to present KPIs and data points in an organized manner.
- Subtle animations to show loading states and transitions, improving user experience without being distracting.
- Glassmorphism effects used in the Training dashboard and Settings page for a modern, polished look.
The color palettes should be like this:
Light: (Clean White/Blue/Gold)

Dark: (High Contrast Navy/White)

Rose: (Soft Blush/Hot Pink/Ink Black/Rose gold)

Slate: (Muted Grey/Indigo/Gunmetal)