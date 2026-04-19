import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        lens: {
          bg: "#070b12",
          surface: "#0d1421",
          card: "#111c2e",
          border: "#1a2840",
          muted: "#1f3050",
          teal: "#0ea5e9",
          "teal-light": "#7dd3fc",
          "teal-dim": "#0c2a3d",
          green: "#10b981",
          "green-light": "#6ee7b7",
          amber: "#f59e0b",
          red: "#ef4444",
          text: "#f0f8ff",
          sub: "#94a3b8",
          dim: "#334155",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan": "scan 2s ease-in-out infinite",
      },
      keyframes: {
        scan: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
