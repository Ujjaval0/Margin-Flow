/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-jakarta)", "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
        tech: ["var(--font-inter)", "sans-serif"],
      },
      colors: {
        apple: {
          canvas: "#F5F5F7",
          card: "#FFFFFF",
          subtle: "#FAFAFC",
          text: "#1D1D1F",
          secondary: "#86868B",
          border: "rgba(0, 0, 0, 0.06)",
          divider: "rgba(0, 0, 0, 0.04)",
          blue: "#0071E3",
          hoverBlue: "#0077ED",
          emerald: "#288548",
          amber: "#B25E00",
          rose: "#D70015",
          charcoal: "#1C1C1E",
        },
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.015)",
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.025)",
        "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.025)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
        "md": "0 3px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.02)",
        "lg": "0 6px 12px -2px rgba(0, 0, 0, 0.035), 0 3px 6px -2px rgba(0, 0, 0, 0.02)",
        "xl": "0 10px 18px -3px rgba(0, 0, 0, 0.04), 0 4px 8px -3px rgba(0, 0, 0, 0.02)",
        "2xl": "0 16px 32px -6px rgba(0, 0, 0, 0.05)",
        "apple-xs": "0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        "apple-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.025)",
        "apple-md": "0 1px 3px 0 rgba(0, 0, 0, 0.025), 0 1px 2px -1px rgba(0, 0, 0, 0.015)",
        "apple-lg": "0 4px 16px -2px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.03)",
      },
      spacing: {
        "4.5": "1.125rem",
        "0.2": "0.05rem",
      },
    },
  },
  safelist: [
    {
      pattern: /(bg|text|border)-(amber|blue|pink|rose|indigo|emerald|purple|teal|cyan|violet|orange|slate)-(50|100|200|300|400|500|600|700|800|900|950)/,
    },
    {
      pattern: /(bg|border)-(amber|blue|pink|rose|indigo|emerald|purple|teal|cyan|violet|orange|slate)-500\/(10|15|20|25)/,
    },
  ],
  plugins: [],
}
