# Wanderwork Landing Page

The landing page is now set up and can be accessed at the root route (`/` or `/landing`).

## Features

- **Clean, modern landing page** with hero section, features, and benefits
- **Integrated Tally form** for sign-ups at https://tally.so/r/wLraG2
- **Smooth animations** using Framer Motion
- **Responsive design** that works on all devices
- **Route-based rendering** - the landing page shows by default

## Routing

The app automatically detects the route:
- `/` or `/landing` → Shows the LandingPage component
- Any other path → Shows the JobSeekerLanding component

## Sign-Up Integration

The sign-up button on the landing page redirects users to the Tally form:
```
https://tally.so/r/wLraG2
```

Users can fill in their information there, and the responses will be collected in your Tally account.

## Customization

To modify the landing page, edit:
- [src/components/LandingPage.tsx](src/components/LandingPage.tsx)

The page includes:
- Navigation bar with sign-up button
- Hero section with main CTA
- Features grid (3 columns)
- How It Works section (4 steps)
- Benefits list
- Final CTA section
- Footer
