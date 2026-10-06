# Reachmark Voice — Design System

## Direction

Reachmark Voice uses a cinematic dark workspace rather than a generic SaaS dashboard. The visual language combines editorial spacing, instrument-like controls, restrained glass surfaces, luminous signal accents and purposeful motion.

## Reference influences

- ScrollTide: scroll-driven composition, cinematic pacing and dashboard references.
- Refero Styles: explicit design tokens, typography hierarchy and spacing discipline.
- Aceternity UI: animated React/Tailwind interaction patterns and shader-inspired surfaces.
- Motion/Anime.js: motion should communicate state, hierarchy and system activity rather than decorate every element.
- 21st.dev, Component Gallery, Navbar Gallery and Footer Design: reference sources for reusable interaction patterns, not direct visual copies.

## Reachmark rules

### Color

- Canvas: near-black `#050507`
- Surface: `#0b0c10`
- Secondary surface: `#101219`
- Primary text: `#f5f7fb`
- Muted text: `#8c93a3`
- Electric violet: `#7657ff`
- Electric blue: `#3f8cff`
- Signal cyan: `#56d9ff`

### Typography

Use a tight modern sans for the product UI. Large headings use negative tracking and restrained weight. Labels may use uppercase micro-type with generous tracking.

### Surfaces

Prefer subtle 1px borders, translucent fills and deep shadows. Avoid excessive cards. A section should feel like a workspace or instrument panel, not a collection of unrelated boxes.

### Motion

- Page entry: fade + 8–16px rise.
- Navigation: short opacity/position transitions.
- Cards: small lift on hover only where it clarifies affordance.
- Voice activity: use waveform/pulse motion to represent actual state.
- Avoid perpetual decorative animation when no system state is changing.

### Product hierarchy

1. Create / generate voice
2. Test voice
3. Build and run agents
4. Inspect conversations
5. Automate workflows

The dashboard should always make the primary voice action obvious within the first viewport.
