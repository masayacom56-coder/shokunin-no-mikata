import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        moss: "#2f6b57",
        paper: "#f7f3ea",
        sumi: "#1f2933"
      }
    }
  },
  plugins: []
};

export default config;
