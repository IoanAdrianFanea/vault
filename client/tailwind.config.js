/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Role-based colour tokens.
        accent: '#0f766e',
        'accent-hover': '#115e59',
        link: '#005c55',
        action: '#213145',
        'action-hover': '#0b1c30',
        ink: '#0f172a',
        'ink-body': '#334155',
        'ink-muted': '#64748b',
        canvas: '#ffffff',
        subtle: '#f8fafc',
        line: '#e2e8f0',
        'line-strong': '#cbd5e1',
        selected: '#f0fdfa',
        status: {
          'teal-bg': '#f0fdfa',
          'teal-text': '#0f766e',
          'teal-border': '#99f6e4',
          'amber-bg': '#fffbeb',
          'amber-text': '#b45309',
          'amber-border': '#fde68a',
          'amber-dot': '#d97706',
          'red-bg': '#fef2f2',
          'red-text': '#b91c1c',
          'red-border': '#fecaca',
          'red-dot': '#dc2626',
          'slate-bg': '#f8fafc',
          'slate-text': '#334155',
          'slate-border': '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        section: ['18px', { lineHeight: '24px', letterSpacing: '-0.015em', fontWeight: '600' }],
        panel: ['15px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['13px', { lineHeight: '18px', letterSpacing: '-0.005em' }],
        small: ['12px', { lineHeight: '16px' }],
        label: ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
        badge: ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
      },
      borderRadius: {
        badge: '3px',
      },
      boxShadow: {
        overlay: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
      },
      zIndex: {
        sticky: '10',
        header: '20',
        bulkbar: '30',
        dropdown: '40',
        popover: '40',
        modal: '50',
        confirm: '60',
        toast: '70',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
