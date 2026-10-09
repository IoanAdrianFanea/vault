/*
Builds the Helmet options, mainly the Content Security Policy, applied to
every response in main.ts. Allows Google Fonts and blob: previews, and
upgrades insecure requests only when the frontend is served over HTTPS.
*/


import type { HelmetOptions } from 'helmet';

export function buildHelmetOptions(frontendUrl?: string): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: frontendUrl?.startsWith('https://')
          ? []
          : null,
      },
    },
  };
}
