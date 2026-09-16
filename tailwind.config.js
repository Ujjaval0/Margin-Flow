/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "SF Pro Text", "sans-serif"],
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
    },
  },
  plugins: [],
}
