# Design System Document: The High-End Marketing Dashboard

## 1. Overview & Creative North Star: "The Digital Architect"
The Creative North Star for this design system is **"The Digital Architect."** This philosophy treats the dashboard not as a flat collection of charts, but as a sophisticated, multi-dimensional environment where data lives within structural layers. 

Unlike "template" dashboards that rely on heavy borders and rigid grids, this system uses **intentional asymmetry** and **tonal depth** to guide the eye. We move beyond the "boxed-in" look by utilizing overlapping elements, expansive white space, and a high-contrast typography scale that feels editorial and authoritative. The goal is to create a space that feels high-tech and trustworthy, mimicking the precision of an architectural blueprint rendered in glass and light.

---

## 2. Colors: Tonal Depth over Borders
Our palette centers on deep, professional blues (`#004bca`, `#006591`) balanced by a sophisticated spectrum of cool surfaces. 

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or containment. Boundaries are defined solely through background color shifts. 
*   **Implementation:** Place a `surface_container_lowest` (pure white) card on a `surface_container_low` background to create a "lift" without a single line.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested, physical layers.
*   **Base:** `background` (#f8f9ff)
*   **Sectioning:** `surface_container_low` (#eff4ff)
*   **Interactive/Primary Focus:** `surface_container_lowest` (#ffffff)
*   **Sub-navigation/Sidebars:** `surface_container` (#e6eeff) or `surface_dim` (#ccdbf3) for high-contrast sidebars.

### The "Glass & Gradient" Rule
To elevate the "high-tech" aesthetic, use Glassmorphism for floating panels (e.g., filter drawers, profile menus). 
*   **Recipe:** `surface_container_lowest` at 70% opacity + `backdrop-filter: blur(20px)`.
*   **Signature Textures:** Use subtle linear gradients for CTAs and "Hero" data points (e.g., `primary` to `primary_container`) to provide visual "soul" that flat fills cannot achieve.

---

## 3. Typography: Editorial Authority
We utilize two typefaces to balance precision with character.

*   **Display & Headlines (Manrope):** A geometric sans-serif that feels modern and high-tech. Use `display-lg` (3.5rem) and `headline-md` (1.75rem) with tighter letter spacing (-0.02em) to create a premium, "branded" feel for high-level metrics.
*   **Body & Titles (Inter):** The workhorse of data. Inter provides exceptional legibility at small sizes. Use `body-md` (0.875rem) for the majority of data labels to maintain a clean, professional density.
*   **The Hierarchy Strategy:** Create "High-Contrast Moments." Pair a `display-sm` metric (Manrope) with a `label-sm` (Inter) in `on_surface_variant` to create a clear, architectural distinction between data and context.

---

## 4. Elevation & Depth: Tonal Layering
Depth is achieved through "Tonal Stacking" rather than traditional structural shadows.

*   **The Layering Principle:** Stack `surface-container` tiers to create natural lift. A card should be `surface_container_lowest` (#ffffff) sitting on a dashboard canvas of `surface_container_low` (#eff4ff).
*   **Ambient Shadows:** If a floating element (like a modal) requires a shadow, use a "Large-Ambient" approach: `box-shadow: 0 20px 40px rgba(13, 28, 46, 0.06)`. The shadow color is a tinted version of `on_surface`, not black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline_variant` at **20% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary_container`), `rounded-md` (0.75rem). No border.
*   **Secondary:** `surface_container_high` background with `primary` text.
*   **Tertiary:** No background; `primary` text with a `primary_fixed` 20% opacity hover state.

### Input Fields
*   **Style:** `surface_container_lowest` background. 
*   **Interaction:** On focus, transition the background to `surface_bright` and add a 2px "Ghost Border" using `primary` at 30% opacity. Forbid the use of heavy bottom-lines or full-opacity outlines.

### Cards & Data Lists
*   **The "No-Divider" Rule:** Forbid 1px horizontal lines between list items. Use the **Spacing Scale** (e.g., `spacing-4`) to separate content or use alternating backgrounds (`surface_container_low` and `surface_container_lowest`).
*   **Rounding:** Apply `rounded-lg` (1rem) for large dashboard cards and `rounded-md` (0.75rem) for internal components like chips or buttons.

### New Component: The Metric "Hero"
*   A large-format card using `tertiary_container` as a background for high-impact insights. Use `display-sm` for the value and `label-md` for the trend indicator, utilizing `secondary_container` for positive growth chips.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts (e.g., a wide 8-column chart next to a narrow 4-column insight list).
*   **Do** use `secondary` (#006591) for interactive data points (links, filters) and `primary` (#004bca) for core actions.
*   **Do** embrace white space. Use `spacing-12` (3rem) between major sections to let the data "breathe."

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#0d1c2e) for high-end legibility.
*   **Don't** use standard "drop shadows" with high opacity. They feel dated and "heavy."
*   **Don't** use dividers. If you feel the need for a line, increase the spacing by two increments on the scale instead.

---

## 7. Tokens Reference Summary

*   **Primary Accent:** `primary` (#004bca)
*   **Vibrant Accent:** `secondary_container` (#39b8fd)
*   **Background Base:** `background` (#f8f9ff)
*   **Corner Radius:** `lg` (1rem) for containers; `md` (0.75rem) for components.
*   **Typography:** Manrope (Headings), Inter (Body).