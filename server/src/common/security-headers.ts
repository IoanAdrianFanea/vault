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
        upgradeInsecureRequests: frontendUrl?.startsWith('https://') ? [] : null,
      },
    },
  };
}
