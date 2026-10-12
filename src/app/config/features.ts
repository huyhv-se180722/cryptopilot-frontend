/**
 * Demo trading routes and their navigation entry exist only when this is
 * on (D-94), so a production build never shows screens whose backend
 * module (`/paper/**`, D-86) is not merged yet.
 */
export const paperTradingEnabled =
  import.meta.env.VITE_ENABLE_PAPER_TRADING === 'true';
