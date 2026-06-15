/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}" , "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        alpha: "#ffc801",
        beta: "#212529",
        error: "#ef4444",
        good: "#51b04f",
        dark_gray: "#1f2326",
        light: "#fafafa",
        dark: "#171717",
        card: "#1c1c1c",
        card_border: "#2e2e2e",

      },
    },
  },
  plugins: [],
}