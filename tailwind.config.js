/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brandRed: '#E00000',
        deepRed: '#B80000',
        brandGold: '#FFD700',
        warmGold: '#F5C542',
        cream: '#FFF9EF',
        ink: '#241B1B',
      },
      boxShadow: {
        soft: '0 20px 50px rgba(36, 27, 27, 0.08)',
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        body: ['Inter', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'hero-pattern': "radial-gradient(circle at top, rgba(255,215,0,0.28), transparent 45%), linear-gradient(135deg, rgba(224,0,0,0.1), rgba(255,255,255,0))",
      },
    },
  },
  plugins: [],
}
