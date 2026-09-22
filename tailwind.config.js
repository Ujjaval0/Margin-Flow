/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SF Mono", "Menlo", "Monaco", "Consolas", "monospace"],
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
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
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
