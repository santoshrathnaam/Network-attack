/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          "Inter",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace"
        ]
      },
      colors: {
        apple: {
          canvas: {
            light: "#F5F5F7",
            dark: "#090A0C"
          },
          card: {
            light: "#FFFFFF",
            dark: "#13161B"
          },
          subtle: {
            light: "#F0F0F2",
            dark: "#1B2028"
          },
          border: {
            light: "#E5E5EA",
            dark: "#252C37"
          },
          borderSubtle: {
            light: "#F2F2F7",
            dark: "#1A1F26"
          },
          text: {
            primaryLight: "#1D1D1F",
            secondaryLight: "#6E6E73",
            tertiaryLight: "#9E9EA4",
            primaryDark: "#F5F5F7",
            secondaryDark: "#949BA6",
            tertiaryDark: "#636A78"
          }
        },
        threat: {
          safe: {
            DEFAULT: "#10B981",
            bg: "#ECFDF5",
            border: "#A7F3D0",
            darkBg: "rgba(16, 185, 129, 0.12)",
            darkBorder: "rgba(16, 185, 129, 0.25)"
          },
          watch: {
            DEFAULT: "#F59E0B",
            bg: "#FFFBEB",
            border: "#FDE68A",
            darkBg: "rgba(245, 158, 11, 0.12)",
            darkBorder: "rgba(245, 158, 11, 0.25)"
          },
          elevated: {
            DEFAULT: "#F97316",
            bg: "#FFF7ED",
            border: "#FFEDD5",
            darkBg: "rgba(249, 115, 22, 0.12)",
            darkBorder: "rgba(249, 115, 22, 0.25)"
          },
          critical: {
            DEFAULT: "#EF4444",
            bg: "#FEF2F2",
            border: "#FECACA",
            darkBg: "rgba(239, 68, 68, 0.12)",
            darkBorder: "rgba(239, 68, 68, 0.25)"
          }
        }
      },
      boxShadow: {
        'apple-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'apple': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.02)',
        'apple-md': '0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -2px rgba(0, 0, 0, 0.03)',
        'apple-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        'apple': '14px',
        'apple-sm': '10px',
        'apple-lg': '18px',
        'apple-xl': '24px',
      }
    },
  },
  plugins: [],
}
