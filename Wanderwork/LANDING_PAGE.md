# Wanderwork Landing Page

The landing page is set up in this `Wanderwork/` app. The newer Figma export in `../Landing/` is kept as a reference source.

## Features

- **Clean, modern landing page** with hero section, features, and benefits
- **Integrated Tally form** for sign-ups at https://tally.so/r/wLraG2
- **Smooth animations** using Framer Motion
- **Responsive design** that works on all devices
- **Landing-first rendering** - the animated landing page shows by default

## Routing

The app automatically detects query parameters:
- / shows the animated Wanderwork landing page
- /?jobs=true shows the Figma landing/reference page

## Login Integration

The login button sends users to the dashboard login route:

```bash
?login=true
```

For local development from the landing app on port 3003, it redirects to:

```bash
http://localhost:5173/?login=true
```

For deployment, set `VITE_DASHBOARD_LOGIN_URL` in the `Wanderwork/` app if the dashboard is hosted on a different domain.

## Sign-Up Integration

The sign-up button currently scrolls users back to the hero CTA area.

## Customization

To modify the landing page, edit:
- [src/components/LandingPageAnimated.tsx](src/components/LandingPageAnimated.tsx)

To refresh from the Figma reference export, compare against:
- [../Landing/src/app/imports/JobSeekerLanding-1-344.tsx](../Landing/src/app/imports/JobSeekerLanding-1-344.tsx)

The page includes:
- Navigation bar with sign-up button
- Hero section with main CTA
- Features grid (3 columns)
- How It Works section (4 steps)
- Benefits list
- Final CTA section
- Footer
