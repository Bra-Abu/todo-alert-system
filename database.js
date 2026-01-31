const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Initialize database
const dbPath = path.join(__dirname, 'todo-alert.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      whatsapp_enabled INTEGER DEFAULT 1,
      telegram_enabled INTEGER DEFAULT 0,
      sms_enabled INTEGER DEFAULT 0,
      browser_notifications_enabled INTEGER DEFAULT 1,
      whatsapp_number TEXT,
      telegram_chat_id TEXT,
      sms_number TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      due_time TEXT NOT NULL,
      recurring TEXT DEFAULT 'none',
      priority TEXT DEFAULT 'medium',
      category TEXT DEFAULT 'general',
      reminder_minutes INTEGER DEFAULT 0,
      notes TEXT,
      snoozed_until TEXT,
      notified INTEGER DEFAULT 0,
      reminder_sent INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      alert_count INTEGER DEFAULT 0,
      last_alert_sent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Subtasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // OTP codes table for authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    )
  `);

  console.log('✅ Database tables created successfully');
}

// Migrate existing tasks from JSON to SQLite
function migrateFromJSON() {
  const jsonPath = path.join(__dirname, 'tasks.json');

  if (!fs.existsSync(jsonPath)) {
    console.log('ℹ️  No tasks.json found, skipping migration');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Check if we already have users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

  if (userCount > 0) {
    console.log('ℹ️  Users already exist, skipping migration');
    return;
  }

  // Create a default user for existing tasks
  const defaultUser = db.prepare(`
    INSERT INTO users (phone_number, name, whatsapp_enabled, telegram_enabled, sms_enabled, browser_notifications_enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('default', 'Default User', 1, 1, 1, 1, new Date().toISOString());

  const defaultUserId = defaultUser.lastInsertRowid;

  // Migrate tasks
  let migratedCount = 0;
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      user_id, title, description, due_date, due_time, recurring, priority, category,
      reminder_minutes, notes, snoozed_until, notified, reminder_sent, completed,
      alert_count, last_alert_sent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSubtask = db.prepare(`
    INSERT INTO subtasks (task_id, text, completed) VALUES (?, ?, ?)
  `);

  for (const task of data.tasks) {
    const result = insertTask.run(
      defaultUserId,
      task.title,
      task.description || '',
      task.dueDate,
      task.dueTime,
      task.recurring || 'none',
      task.priority || 'medium',
      task.category || 'general',
      task.reminderMinutes || 0,
      task.notes || '',
      task.snoozedUntil || null,
      task.notified ? 1 : 0,
      task.reminderSent ? 1 : 0,
      task.completed ? 1 : 0,
      task.alertCount || 0,
      task.lastAlertSent || null,
      task.createdAt
    );

    // Migrate subtasks if they exist
    if (task.subtasks && Array.isArray(task.subtasks)) {
      for (const subtask of task.subtasks) {
        insertSubtask.run(result.lastInsertRowid, subtask.text, subtask.completed ? 1 : 0);
      }
    }

    migratedCount++;
  }

  console.log(`✅ Migrated ${migratedCount} tasks from JSON to SQLite`);

  // Backup the old JSON file
  const backupPath = path.join(__dirname, 'tasks.json.backup');
  fs.copyFileSync(jsonPath, backupPath);
  console.log(`✅ Backed up tasks.json to tasks.json.backup`);
}

// User management functions
const userDB = {
  create: (phoneNumber, name, passwordHash) => {
    const stmt = db.prepare(`
      INSERT INTO users (phone_number, name, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(phoneNumber, name, passwordHash, new Date().toISOString());
  },

  findByPhone: (phoneNumber) => {
    return db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phoneNumber);
  },

  updateLastLogin: (userId) => {
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), userId);
  },

  updateAlertPreferences: (userId, preferences) => {
    const stmt = db.prepare(`
      UPDATE users SET
        whatsapp_enabled = ?,
        telegram_enabled = ?,
        sms_enabled = ?,
        browser_notifications_enabled = ?,
        whatsapp_number = ?,
        telegram_chat_id = ?,
        sms_number = ?
      WHERE id = ?
    `);
    return stmt.run(
      preferences.whatsapp_enabled ? 1 : 0,
      preferences.telegram_enabled ? 1 : 0,
      preferences.sms_enabled ? 1 : 0,
      preferences.browser_notifications_enabled ? 1 : 0,
      preferences.whatsapp_number || null,
      preferences.telegram_chat_id || null,
      preferences.sms_number || null,
      userId
    );
  },

  getAlertPreferences: (userId) => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }
};

// Task management functions
const taskDB = {
  create: (userId, taskData) => {
    const stmt = db.prepare(`
      INSERT INTO tasks (
        user_id, title, description, due_date, due_time, recurring, priority, category,
        reminder_minutes, notes, notified, reminder_sent, completed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
    `);
    return stmt.run(
      userId,
      taskData.title,
      taskData.description || '',
      taskData.dueDate,
      taskData.dueTime,
      taskData.recurring || 'none',
      taskData.priority || 'medium',
      taskData.category || 'general',
      taskData.reminderMinutes || 0,
      taskData.notes || '',
      new Date().toISOString()
    );
  },

  getAllByUser: (userId) => {
    const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date, due_time').all(userId);
    // Attach subtasks to each task
    for (const task of tasks) {
      task.subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(task.id);
    }
    return tasks;
  },

  getById: (taskId, userId) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId);
    if (task) {
      task.subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(task.id);
    }
    return task;
  },

  update: (taskId, userId, updates) => {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), taskId, userId];
    const stmt = db.prepare(`UPDATE tasks SET ${fields} WHERE id = ? AND user_id = ?`);
    return stmt.run(...values);
  },

  delete: (taskId, userId) => {
    return db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, userId);
  },

  complete: (taskId, userId) => {
    return db.prepare('UPDATE tasks SET completed = 1 WHERE id = ? AND user_id = ?').run(taskId, userId);
  },

  snooze: (taskId, userId, minutes) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
    return db.prepare('UPDATE tasks SET snoozed_until = ? WHERE id = ? AND user_id = ?').run(snoozedUntil, taskId, userId);
  },

  getDueTasks: () => {
    // Optimized: Filter by date/time in SQL instead of JavaScript
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    const tasks = db.prepare(`
      SELECT tasks.*, users.whatsapp_enabled, users.telegram_enabled, users.sms_enabled,
             users.whatsapp_number, users.telegram_chat_id, users.sms_number, users.phone_number
      FROM tasks
      INNER JOIN users ON tasks.user_id = users.id
      WHERE tasks.completed = 0
        AND (
          tasks.due_date < ?
          OR (tasks.due_date = ? AND tasks.due_time <= ?)
        )
    `).all(currentDate, currentDate, currentTime);

    for (const task of tasks) {
      task.subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ?').all(task.id);
    }
    return tasks;
  }
};

// Subtask management functions
const subtaskDB = {
  add: (taskId, text) => {
    return db.prepare('INSERT INTO subtasks (task_id, text, completed) VALUES (?, ?, 0)').run(taskId, text);
  },

  toggle: (subtaskId) => {
    return db.prepare('UPDATE subtasks SET completed = NOT completed WHERE id = ?').run(subtaskId);
  },

  delete: (subtaskId) => {
    return db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);
  }
};

// OTP management functions
const otpDB = {
  create: (phoneNumber, code) => {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 minutes expiry
    return db.prepare(`
      INSERT INTO otp_codes (phone_number, code, created_at, expires_at, used)
      VALUES (?, ?, ?, ?, 0)
    `).run(phoneNumber, code, createdAt, expiresAt);
  },

  verify: (phoneNumber, code) => {
    const otp = db.prepare(`
      SELECT * FROM otp_codes
      WHERE phone_number = ? AND code = ? AND used = 0 AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(phoneNumber, code, new Date().toISOString());

    if (otp) {
      // Mark as used
      db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otp.id);
      return true;
    }
    return false;
  },

  cleanup: () => {
    // Delete expired OTPs
    db.prepare('DELETE FROM otp_codes WHERE expires_at < ? OR used = 1').run(new Date().toISOString());
  }
};

// Initialize database on first run
initializeDatabase();
migrateFromJSON();

module.exports = {
  db,
  userDB,
  taskDB,
  subtaskDB,
  otpDB
};
