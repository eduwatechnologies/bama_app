/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#20252b',
    tint: '#d9653b',

    // Core surfaces
    background: '#f8f5ef',
    foreground: '#20252b',

    // Cards / elevated surfaces
    card: '#fffdf9',
    cardForeground: '#20252b',

    // Primary action color (buttons, links, active states)
    primary: '#d9653b',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#ece6dc',
    secondaryForeground: '#4a514e',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#eee9e0',
    mutedForeground: '#7a807c',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#dce9df',
    accentForeground: '#315843',

    // Destructive actions (delete, error states)
    destructive: '#b84b3a',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#e4ddd1',
    input: '#d8d0c4',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
