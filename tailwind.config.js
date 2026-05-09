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
        lb: {
          bg: "#0B0907",
          pill: "#161412",
          elevated: "#1a1612",
          card: "#181612",
          border: "rgba(255,196,60,0.22)",
          soft: "rgba(255,210,120,0.14)",
          text: "#f5f2ec",
          section: "#a8a29e",
          beige: "#c9bdb0",
          muted: "rgba(200,190,175,0.72)",
          dim: "#8a8278",
          gold: "#ffc801",
          neon: "#4ade80",
          timebox: "rgba(10,9,8,0.92)",
          list: "rgba(24,20,18,0.88)",
          ring2: "rgba(156,168,184,0.85)",
          ring3: "rgba(212,130,65,0.95)",
          rank2: "rgba(110,118,128,0.95)",
          rank3: "rgba(196,110,48,0.98)",
          glassline: "rgba(255,220,140,0.12)",
        },
      },
      fontFamily: {
        space: ["SpaceMono", "monospace"],
      },
      boxShadow: {
        lb: "0 4px 14px rgba(255, 190, 40, 0.22)",
        "lb-fab": "0 8px 24px rgba(255, 196, 60, 0.55)",
        "lb-gold": "0 0 18px rgba(255, 196, 60, 0.55)",
        "lb-silver": "0 0 10px rgba(156, 168, 184, 0.35)",
        "lb-bronze": "0 0 12px rgba(212, 130, 65, 0.45)",
        "lb-pill": "0 2px 8px rgba(0, 0, 0, 0.35)",
        "lb-online": "0 0 6px rgba(74, 222, 128, 0.65)",
      },
    },
  },
  plugins: [],
}