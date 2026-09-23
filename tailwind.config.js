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
        "apple-sm": "0px 2px 3px -1px rgba(0,0,0,0.1), 0px 1px 0px 0px rgba(25,28,33,0.02), 0px 0px 0px 1px rgba(25,28,33,0.08)",
        "apple-md": "0px 0px 0px 1px rgba(0,0,0,0.06), 0px 1px 1px -0.5px rgba(0,0,0,0.06), 0px 3px 3px -1.5px rgba(0,0,0,0.06), 0px 6px 6px -3px rgba(0,0,0,0.06), 0px 12px 12px -6px rgba(0,0,0,0.06), 0px 24px 24px -12px rgba(0,0,0,0.06)",
        "apple-lg": "0 2.8px 2.2px rgba(0,0,0,0.034), 0 6.7px 5.3px rgba(0,0,0,0.048), 0 12.5px 10px rgba(0,0,0,0.06), 0 22.3px 17.9px rgba(0,0,0,0.072), 0 41.8px 33.4px rgba(0,0,0,0.086), 0 100px 80px rgba(0,0,0,0.12)",
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
