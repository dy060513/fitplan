/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色：深邃运动蓝（与 App 图标一致），深色底上的高级感
        brand: {
          50: '#eef5ff',
          100: '#d9e9ff',
          200: '#bcd9ff',
          300: '#8ec2ff',
          400: '#59a0ff',
          500: '#338bff',
          600: '#1f6ef0',
          700: '#1759cc',
          800: '#1747a3',
          900: '#183d7f',
          950: '#122752',
        },
        // 页面底色
        ink: {
          DEFAULT: '#0a0d12',
          soft: '#10141b',
          card: '#12161d',
        },
        paper: '#f5f5f4',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.05), 0 8px 24px -12px rgb(15 23 42 / 0.12)',
        'card-dark': '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 12px 32px -16px rgb(0 0 0 / 0.6)',
        glow: '0 6px 24px -6px rgb(51 139 255 / 0.45)',
        'glow-sm': '0 2px 12px -2px rgb(51 139 255 / 0.4)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
