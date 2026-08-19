/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0c",
        foreground: "#f4f4f7",
        card: "#121216",
        border: "#232329",
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
        },
      },
    },
  },
  plugins: [],
}
