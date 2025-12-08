# BudgetBuddy

Personal finance web app to track expenses, budgets, conversions, and tips. Built as a static site—no backend required.

## Run locally
1. From this folder run a local server (for module imports): `python3 -m http.server 8000`.
2. Open `http://localhost:8000` in your browser.
3. Allow network access for the ExchangeRate and Advice APIs (charts use the Chart.js CDN).

## Deploy
- Drop the folder into Netlify/Vercel/Render static hosting or GitHub Pages.
- Ensure external requests to `https://api.exchangerate-api.com` and `https://api.adviceslip.com` are allowed.

## Features
- Expense capture with categories and dates; localStorage persistence.
- Monthly budget tracking with alerts and progress.
- Filtering by category, recent/history lists, and delete support.
- Charts (Chart.js) for category spend (pie) and last 6 months totals (bar).
- Currency converter with live rates and cached dropdowns for all currencies.
- Random finance advice, theme toggle (light/dark), and data reset.

## Testing checklist
- Add multiple expenses across categories and months; verify charts and totals.
- Set/adjust budget; confirm alert triggers when spending exceeds limit.
- Convert currencies (same and different); ensure status messaging works.
- Toggle theme and refresh to confirm persistence.
- Use category filter and delete buttons in history; verify counts/charts update.
