import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import Database from "better-sqlite3";
import session from "express-session";
import flash from "connect-flash";

// basic configurations for backend
dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();

// store some imp session data using middleware
app.use(session({
  secret: "ishalovestocode2005",
  resave: false,
  saveUninitialized: false
}));

// allows us to use static files outside
app.use(express.static("public"));
// allows us to access form data
app.use(bodyParser.urlencoded({ extended: true }));
// allows us to send alerts from here 
app.use(flash());
// makes flash messages available to all views
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});


//database handling
const db = new Database("./database/FinTracker.db");

// PERSONAL DATA (already created)
// db.prepare(`
//   CREATE TABLE IF NOT EXISTS personal_data (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     name TEXT NOT NULL,
//     password TEXT NOT NULL
//   )
// `).run();

// INCOME-EXPENSES (already created)
// db.prepare("DROP TABLE IF EXISTS transactions").run();
// db.prepare(`
//   CREATE TABLE IF NOT EXISTS transactions (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,        -- transaction id
//     user_id INTEGER NOT NULL,                    -- linked to users(id)
//     type INTEGER NOT NULL CHECK (type IN (-1, 1)), -- -1 = expense, 1 = income
//     name TEXT NOT NULL,                          -- e.g. "Salary", "Groceries"
//     amount REAL NOT NULL,
//     category TEXT,                               -- e.g. "Food", "Transport"
//     date TEXT DEFAULT (DATE('now')),    -- ISO format string "2025-08-21"
//     recurrence TEXT DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')), -- optional
//     FOREIGN KEY (user_id) REFERENCES personal_data(id)
//   )
// `).run();

// SAVINGS table (create if not exists)
db.prepare(`
  CREATE TABLE IF NOT EXISTS savings (
    user_id INTEGER PRIMARY KEY,
    total_amount REAL DEFAULT 0,
    last_updated TEXT DEFAULT (DATE('now')),
    FOREIGN KEY (user_id) REFERENCES personal_data(id)
  )
`).run();

// SAVINGS_GOALS table (create if not exists)
db.prepare(`
  CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goal_name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    target_date TEXT,
    FOREIGN KEY (user_id) REFERENCES personal_data(id)
  )
`).run();

// routes

// login page
app.get("/", (req, res) => {
  res.redirect("/login");
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// home page after login submit
app.post("/home", (req, res) => {
  // iterate through all the names in personal_data and check if any passwords match
  const rows = db.prepare("SELECT * FROM personal_data").all();
  const user = rows.find(row => row.name === req.body.username && row.password === req.body.password);

  if (user) {
    req.session.username = user.name;
    req.session.user_id = user.id;
    res.redirect("/home");
  } else {
    res.redirect("/login");
  }
});

// home for redirections
app.get("/home", (req, res) => {

  // pie chart values
  // query to sum expenses by category
  const transactions = db.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND type = -1
    GROUP BY category
  `).all(req.session.user_id);

  // Set the pie chart data
  let Food = 0, People = 0, SelfCare = 0, Housing = 0, Travel = 0, Other = 0, sumOfAll = 0;
  transactions.forEach(item => {
    if (item.category === "Food") {
      Food += item.total;
    } else if (item.category === "Family") {
      People += item.total;
    } else if (item.category === "Friends") {
      People += item.total;
    } else if (item.category === "Housing") {
      Housing += item.total;
    } else if (item.category === "Travel/ Events") {
      Travel += item.total;
    } else if (item.category === "Clothes/ Cosmetics") {
      SelfCare += item.total;
    } else {
      Other += item.total;
    }
  });

  sumOfAll = Food + People + SelfCare + Housing + Travel + Other;
  Food = Food*100 / sumOfAll;
  People = People*100 / sumOfAll;
  SelfCare = SelfCare*100 / sumOfAll;
  Housing = Housing*100 / sumOfAll;
  Travel = Travel*100 / sumOfAll;
  Other = Other*100 / sumOfAll;

  // Weekly budget calculation
  // Get the start of the current week (Monday)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to subtract to get Monday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // Get weekly expenses for the current week
  const weeklyExpenses = db.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND type = -1 AND date >= ?
    GROUP BY category
  `).all(req.session.user_id, startOfWeekStr);

  // Budget limits
  const BUDGET_LIMITS = {
    Food: 50,
    SelfCare: 10,
    Other: 10
  };

  // Calculate spent amounts for each budget category
  let foodSpent = 0;
  let selfCareSpent = 0;
  let otherSpent = 0;

  weeklyExpenses.forEach(item => {
    if (item.category === "Food") {
      foodSpent += item.total;
    } else if (item.category === "Clothes/ Cosmetics") {
      selfCareSpent += item.total;
    } else {
      // All other categories count as "Other"
      otherSpent += item.total;
    }
  });

  // Calculate remaining budget and percentage used
  const foodRemaining = Math.max(0, BUDGET_LIMITS.Food - foodSpent);
  const selfCareRemaining = Math.max(0, BUDGET_LIMITS.SelfCare - selfCareSpent);
  const otherRemaining = Math.max(0, BUDGET_LIMITS.Other - otherSpent);

  const foodPercent = (foodSpent / BUDGET_LIMITS.Food) * 100;
  const selfCarePercent = (selfCareSpent / BUDGET_LIMITS.SelfCare) * 100;
  const otherPercent = (otherSpent / BUDGET_LIMITS.Other) * 100;

  // Calculate weekly savings (remaining budget from all categories)
  const weeklySavings = foodRemaining + selfCareRemaining + otherRemaining;

  // Get or create savings record for user
  let savingsRecord = db.prepare("SELECT * FROM savings WHERE user_id = ?").get(req.session.user_id);
  if (!savingsRecord) {
    db.prepare("INSERT INTO savings (user_id, total_amount) VALUES (?, ?)").run(req.session.user_id, 0);
    savingsRecord = { user_id: req.session.user_id, total_amount: 0, last_updated: startOfWeekStr };
  }

  // Check if we need to add weekly savings (at end of week - Sunday)
  // Get the last week's remaining budget if we're past Sunday
  const lastUpdated = new Date(savingsRecord.last_updated);
  const lastUpdatedWeekStart = new Date(lastUpdated);
  const lastUpdatedDayOfWeek = lastUpdated.getDay();
  const daysToLastMonday = lastUpdatedDayOfWeek === 0 ? 6 : lastUpdatedDayOfWeek - 1;
  lastUpdatedWeekStart.setDate(lastUpdated.getDate() - daysToLastMonday);
  lastUpdatedWeekStart.setHours(0, 0, 0, 0);
  
  // If we're in a new week and haven't processed last week's savings
  if (startOfWeek > lastUpdatedWeekStart) {
    // Calculate last week's remaining budget
    const lastWeekStartStr = lastUpdatedWeekStart.toISOString().split('T')[0];
    const lastWeekEnd = new Date(lastUpdatedWeekStart);
    lastWeekEnd.setDate(lastUpdatedWeekStart.getDate() + 6);
    const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];
    
    const lastWeekExpenses = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND type = -1 AND date >= ? AND date <= ?
      GROUP BY category
    `).all(req.session.user_id, lastWeekStartStr, lastWeekEndStr);
    
    let lastWeekFoodSpent = 0;
    let lastWeekSelfCareSpent = 0;
    let lastWeekOtherSpent = 0;
    
    lastWeekExpenses.forEach(item => {
      if (item.category === "Food") {
        lastWeekFoodSpent += item.total;
      } else if (item.category === "Clothes/ Cosmetics") {
        lastWeekSelfCareSpent += item.total;
      } else {
        lastWeekOtherSpent += item.total;
      }
    });
    
    const lastWeekRemaining = Math.max(0, BUDGET_LIMITS.Food - lastWeekFoodSpent) +
                              Math.max(0, BUDGET_LIMITS.SelfCare - lastWeekSelfCareSpent) +
                              Math.max(0, BUDGET_LIMITS.Other - lastWeekOtherSpent);
    
    // Add last week's savings to total
    const newTotal = savingsRecord.total_amount + lastWeekRemaining;
    db.prepare("UPDATE savings SET total_amount = ?, last_updated = ? WHERE user_id = ?")
      .run(newTotal, today.toISOString().split('T')[0], req.session.user_id);
    savingsRecord.total_amount = newTotal;
  }

  // Get savings goals (max 3)
  const savingsGoals = db.prepare(`
    SELECT id, goal_name, target_amount, target_date
    FROM savings_goals
    WHERE user_id = ?
    ORDER BY id ASC
    LIMIT 3
  `).all(req.session.user_id);

  // Check which goals are achieved
  const goalsWithStatus = savingsGoals.map(goal => {
    const isAchieved = savingsRecord.total_amount >= goal.target_amount;
    return {
      ...goal,
      isAchieved: isAchieved
    };
  });

  // JUST FOR DEBUGGING -FIXME
  console.log("Pie chart data debugger");
  console.log(db.prepare(`SELECT category, type, amount FROM transactions WHERE user_id = ?`).all(req.session.user_id));
  console.log(transactions);
  console.log( Food);

  res.render("home.ejs", { 
    username: req.session.username, 
    food: Food, 
    people: People, 
    selfCare: SelfCare, 
    housing: Housing, 
    travel: Travel, 
    other: Other,
    // Weekly budget data
    budgetData: {
      food: {
        spent: foodSpent,
        remaining: foodRemaining,
        limit: BUDGET_LIMITS.Food,
        percent: foodPercent
      },
      selfCare: {
        spent: selfCareSpent,
        remaining: selfCareRemaining,
        limit: BUDGET_LIMITS.SelfCare,
        percent: selfCarePercent
      },
      other: {
        spent: otherSpent,
        remaining: otherRemaining,
        limit: BUDGET_LIMITS.Other,
        percent: otherPercent
      }
    },
    // Savings data
    savingsData: {
      total: savingsRecord.total_amount || 0,
      weeklySavings: weeklySavings || 0,
      goals: goalsWithStatus || []
    }
  });
});

// transactions
app.post("/transactions", (req, res) => {
  // check if user is currently logged in
  const user_id = req.session.user_id;
  if (!user_id) {
    return res.status(401).send("You must log in first.");
  }

  // Insert the transaction into the database
  let category = req.body.category, date = req.body.date, recurrence = req.body.recurrence;

  if (date === "") {
    date = new Date().toISOString().split('T')[0]; // current date in "YYYY-MM-DD" format
  }
  if (recurrence === "") {
    recurrence = "none";
  }
  if (category === "") {
    category = "Other";
  }
  db.prepare(`
    INSERT INTO transactions (user_id, type, name, amount, category, date, recurrence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user_id, req.body.type, req.body.transactionName, req.body.transactionAmount, category, date, recurrence);
  
  // JUST FOR DEBUGGING -FIXME
  console.log("User data");
  console.log(db.prepare(`SELECT * FROM transactions WHERE user_id = ?`).all(user_id));
  console.log("All the data");
  console.log(db.prepare(`SELECT * FROM transactions`).all());
  
  // when submit is successful i want an alert or a popup to come on the screen
  req.flash("success", "Transaction added successfully!");
  res.redirect("/home");
});

// transaction table page
app.get("/transaction_table", (req, res) => {
  // check if user is currently logged in
  const user_id = req.session.user_id;
  if (!user_id) {
    return res.status(401).send("You must log in first.");
  }

  // Fetch all transactions for the logged-in user, ordered by date (newest first)
  const transactions = db.prepare(`
    SELECT id, type, name, amount, category, date, recurrence
    FROM transactions
    WHERE user_id = ?
    ORDER BY date DESC, id DESC
  `).all(user_id);

  res.render("transaction_table.ejs", { 
    username: req.session.username,
    transactions: transactions
  });
});

// Add savings goal
app.post("/savings-goal", (req, res) => {
  const user_id = req.session.user_id;
  if (!user_id) {
    return res.status(401).send("You must log in first.");
  }

  // Check if user already has 3 goals
  const existingGoals = db.prepare("SELECT COUNT(*) as count FROM savings_goals WHERE user_id = ?").get(user_id);
  if (existingGoals.count >= 3) {
    req.flash("error", "You can only have up to 3 savings goals.");
    return res.redirect("/home");
  }

  const { goalName, targetAmount, targetDate } = req.body;

  if (!goalName || !targetAmount) {
    req.flash("error", "Goal name and target amount are required.");
    return res.redirect("/home");
  }

  db.prepare(`
    INSERT INTO savings_goals (user_id, goal_name, target_amount, target_date)
    VALUES (?, ?, ?, ?)
  `).run(user_id, goalName, parseFloat(targetAmount), targetDate || null);

  req.flash("success", "Savings goal added successfully!");
  res.redirect("/home");
});

// required to listen for incoming requests
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});