import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Core Graphite / Pitch-Black Palette ──────────────────────
        canvas:  '#121212',
        panel:   '#1e1e1e',
        surface: '#252525',
        overlay: '#2c2c2c',
        border:  '#333333',

        // ── Text ─────────────────────────────────────────────────────
        'text-primary':   '#e8e8e8',
        'text-secondary': '#a0a0a0',
        'text-muted':     '#5a5a5a',

        // ── Accent ───────────────────────────────────────────────────
        accent: {
          DEFAULT: '#7c6af7',
          dim:     '#5a4fd6',
          glow:    'rgba(124,106,247,0.18)',
        },

        // ── Semantic ─────────────────────────────────────────────────
        success: '#4caf87',
        warning: '#d4a04a',
        danger:  '#e05c5c',
      },

      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },

      borderRadius: {
        sm:  '4px',
        md:  '6px',
        lg:  '10px',
        xl:  '14px',
        '2xl': '18px',
      },

      boxShadow: {
        'panel':     '0 0 0 1px rgba(255,255,255,0.04)',
        'card':      '0 2px 12px rgba(0,0,0,0.55)',
        'accent':    '0 0 0 2px rgba(124,106,247,0.45)',
        'inset-sm':  'inset 0 1px 3px rgba(0,0,0,0.4)',
      },

      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },

      animation: {
        'fade-in':   'fadeIn 0.2s ease forwards',
        'slide-in':  'slideIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards',
        'ping-badge':'ping 1s cubic-bezier(0,0,0.2,1) 1',
      },

      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },

      // ── Typography plugin customisation ───────────────────────────
      // These overrides map prose tokens to the Noteer graphite palette.
      typography: () => ({
        noteer: {
          css: {
            '--tw-prose-body':          '#a0a0a0',
            '--tw-prose-headings':      '#e8e8e8',
            '--tw-prose-lead':          '#a0a0a0',
            '--tw-prose-links':         '#7c6af7',
            '--tw-prose-bold':          '#e8e8e8',
            '--tw-prose-counters':      '#5a5a5a',
            '--tw-prose-bullets':       '#5a5a5a',
            '--tw-prose-hr':            '#333333',
            '--tw-prose-quotes':        '#a0a0a0',
            '--tw-prose-quote-borders': '#7c6af7',
            '--tw-prose-captions':      '#5a5a5a',
            '--tw-prose-code':          '#e8e8e8',
            '--tw-prose-pre-code':      '#e8e8e8',
            '--tw-prose-pre-bg':        '#1e1e1e',
            '--tw-prose-th-borders':    '#333333',
            '--tw-prose-td-borders':    '#333333',
            // reset max-width so the parent container controls layout
            maxWidth: 'none',
            // tighten line-height for dense note-taking context
            lineHeight: '1.7',
            // heading tweaks
            h1: { fontSize: '1.4em', marginTop: '0', marginBottom: '0.6em', fontWeight: '600' },
            h2: { fontSize: '1.15em', marginTop: '1.4em', marginBottom: '0.4em', fontWeight: '600' },
            h3: { fontSize: '1.0em', marginTop: '1.2em', marginBottom: '0.3em', fontWeight: '600' },
            // code blocks
            'pre': {
              backgroundColor: '#1e1e1e',
              borderRadius: '6px',
              border: '1px solid #333333',
              padding: '0.75rem 1rem',
            },
            'code': {
              backgroundColor: '#2c2c2c',
              borderRadius: '3px',
              padding: '0.15em 0.35em',
              fontWeight: '400',
            },
            // strip the code backtick pseudo-elements added by prose
            'code::before': { content: '""' },
            'code::after':  { content: '""' },
            // blockquote
            'blockquote': {
              borderLeftColor: '#7c6af7',
              borderLeftWidth: '2px',
              color: '#a0a0a0',
              fontStyle: 'italic',
            },
            // horizontal rule
            'hr': { borderColor: '#333333' },
            // links
            'a': { color: '#7c6af7', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
            // table
            'thead th': { color: '#e8e8e8', borderBottomColor: '#333333' },
            'tbody tr': { borderBottomColor: '#2c2c2c' },
            // task list checkboxes
            'input[type="checkbox"]': { accentColor: '#7c6af7' },
          },
        },
      }),
    },
  },
  plugins: [typography],
};

export default config;
