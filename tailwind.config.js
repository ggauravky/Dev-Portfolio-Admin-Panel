const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: token("ink"), raised: token("ink-raised") },
        rule: token("rule"), paper: token("paper"), muted: token("muted"), accent: token("accent"),
        boundary: token("boundary"), error: token("error"), warning: token("warning"), success: token("success"),
      },
      fontFamily: Object.fromEntries(["serif", "sans", "mono"].map((font) => [font, [`var(--font-${font})`]])),
      fontSize: { display: ["var(--text-display)", "1.08"], h2: ["var(--text-h2)", "1.2"], h3: ["var(--text-h3)", "1.2"],
        body: ["var(--text-body)", "1.55"], small: ["var(--text-small)", "1.5"] },
      spacing: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`step-${index + 1}`, `var(--space-${index + 1})`])),
      borderRadius: { control: "var(--radius-control)", dialog: "var(--radius-dialog)" },
      boxShadow: { dialog: "var(--shadow-dialog)" },
    },
  },
  plugins: [],
};
