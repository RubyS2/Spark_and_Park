/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 👈 이 줄을 추가합니다!
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}