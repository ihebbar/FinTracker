# FinTracker - Budgeting Plan

A simple, user-friendly personal finance tracker to help you easily navigate your expenses! A personal budgeting and expense tracking web application built with Node.js, Express, and SQLite.

## Features

- **User Authentication**: Login system with session management
- **Transaction Logging**: Add income and expense transactions with categories
- **Budget Tracking**: Weekly budget tracking for Food, Self-Care, and Other categories
- **Savings Goals**: Set up to 3 savings goals and track progress
- **Transaction History**: View all transactions in a table format
- **Visual Analytics**: Pie chart showing expense breakdown by category

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Frontend**: EJS templates, Tailwind CSS, Chart.js
- **Authentication**: Express-session

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (optional):
   ```
   PORT=3000
   ```
4. Run the application:
   ```bash
   node app.js
   ```
5. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
Project 2) Budgeting Plan/
├── app.js                 # Main server file
├── package.json           # Dependencies
├── database/             # SQLite database (not in repo)
│   └── FinTracker.db
├── public/               # Static files (CSS)
├── views/                # EJS templates
│   ├── home.ejs
│   ├── login.ejs
│   ├── income-expense.ejs
│   ├── budget-saving.ejs
│   ├── transaction_table.ejs
│   └── partials/
└── .gitignore
```

## Database Schema

- **personal_data**: User accounts
- **transactions**: Income and expense records
- **savings**: Total savings per user
- **savings_goals**: User savings goals (max 3)

## Notes

- The database file (`FinTracker.db`) is not included in the repository
- Create your own database by running the application (tables are created automatically)
- Default port is 3000 (can be changed via .env file)
