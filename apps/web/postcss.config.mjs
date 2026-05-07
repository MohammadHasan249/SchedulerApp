// Skip PostCSS processing in test environment
const config = process.env.NODE_ENV === 'test' ? { plugins: {} } : {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
