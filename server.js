const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const path = require('path');
const twilio = require('twilio');
const TelegramBot = require('node-telegram-bot-api');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { db, userDB, taskDB, subtaskDB, otpDB } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'todo-alert-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));
app.use(express.static('public'));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Initialize Twilio (WhatsApp)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    !process.env.TWILIO_ACCOUNT_SID.includes('your_') &&
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Initialize Telegram Bot
let telegramBot = null;
if (process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('your_')) {
  telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

  // Telegram bot commands
  telegramBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    telegramBot.sendMessage(chatId, `
🤖 *Todo Alert Bot*

Your Chat ID: \`${chatId}\`

To receive alerts via Telegram:
1. Copy this Chat ID
2. Log in to the Todo Alert System
3. Go to Settings/Preferences
4. Paste your Chat ID in the Telegram field
5. Enable Telegram alerts

You'll receive task notifications here!
    `, { parse_mode: 'Markdown' });
  });
}

// Generate random OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via SMS
async function sendOTPSMS(phoneNumber, code) {
  if (!twilioClient) {
    console.log('Twilio not configured for OTP');
    return false;
  }

  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
      body: `Your Todo Alert System verification code is: ${code}\n\nThis code expires in 10 minutes.`
    });
    console.log(`OTP sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error('OTP SMS error:', error.message);
    return false;
  }
}

// Send WhatsApp notification (per-user)
async function sendWhatsAppAlert(task, user, isReminder = false) {
  if (!twilioClient || !user.whatsapp_enabled || !user.whatsapp_number) {
    return false;
  }

  try {
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
    const prefix = isReminder ? '⏰ Early Reminder' : '🔔 Task Due';

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: user.whatsapp_number,
      body: `${prefix}\n\n${priorityEmoji[task.priority || 'medium']} *${task.title}*\n${task.description ? '📝 ' + task.description + '\n' : ''}📅 ${task.due_date} ⏰ ${task.due_time}\n🏷️ ${task.category || 'general'}`
    });
    console.log(`WhatsApp alert sent to ${user.phone_number} for task: ${task.title}`);
    return true;
  } catch (error) {
    console.error('WhatsApp error:', error.message);
    return false;
  }
}

// Send Telegram notification (per-user)
async function sendTelegramAlert(task, user, isReminder = false) {
  if (!telegramBot || !user.telegram_enabled || !user.telegram_chat_id) {
    return false;
  }

  try {
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
    const prefix = isReminder ? '⏰ *Early Reminder*' : '🔔 *Task Due*';

    await telegramBot.sendMessage(
      user.telegram_chat_id,
      `${prefix}\n\n${priorityEmoji[task.priority || 'medium']} *${task.title}*\n${task.description ? '📝 ' + task.description + '\n' : ''}📅 ${task.due_date} ⏰ ${task.due_time}\n🏷️ ${task.category || 'general'}`,
      { parse_mode: 'Markdown' }
    );
    console.log(`Telegram alert sent to ${user.phone_number} for task: ${task.title}`);
    return true;
  } catch (error) {
    console.error('Telegram error:', error.message);
    return false;
  }
}

// Send SMS notification (per-user)
async function sendSMSAlert(task, user, isReminder = false) {
  if (!twilioClient || !user.sms_enabled || !user.sms_number) {
    return false;
  }

  try {
    const prefix = isReminder ? 'REMINDER' : 'DUE NOW';
    const priority = (task.priority || 'medium').toUpperCase();

    await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.sms_number,
      body: `[${prefix}] ${priority}: ${task.title}\n${task.due_date} at ${task.due_time}\nCategory: ${task.category || 'general'}`
    });
    console.log(`SMS alert sent to ${user.phone_number} for task: ${task.title}`);
    return true;
  } catch (error) {
    console.error('SMS error:', error.message);
    return false;
  }
}

// Check for due tasks every minute
cron.schedule('* * * * *', async () => {
  try {
    const tasks = taskDB.getDueTasks();
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    for (const task of tasks) {
      if (task.completed) continue;

      // Build user object from task data
      const user = {
        phone_number: task.phone_number,
        whatsapp_enabled: task.whatsapp_enabled,
        telegram_enabled: task.telegram_enabled,
        sms_enabled: task.sms_enabled,
        whatsapp_number: task.whatsapp_number,
        telegram_chat_id: task.telegram_chat_id,
        sms_number: task.sms_number
      };

      // Check if task is snoozed
      if (task.snoozed_until && new Date(task.snoozed_until) > now) {
        continue; // Skip snoozed tasks
      } else if (task.snoozed_until && new Date(task.snoozed_until) <= now) {
        // Snooze expired, reset
        taskDB.update(task.id, task.user_id, {
          snoozed_until: null,
          notified: 0,
          reminder_sent: 0
        });
      }

      const taskDateTime = new Date(`${task.due_date}T${task.due_time}`);
      const reminderMinutes = task.reminder_minutes || 0;
      const reminderTime = new Date(taskDateTime.getTime() - reminderMinutes * 60000);

      // Send early reminder
      if (reminderMinutes > 0 && !task.reminder_sent && now >= reminderTime && now < taskDateTime) {
        console.log(`Sending reminder for task: ${task.title} (${reminderMinutes} min before)`);

        await sendWhatsAppAlert(task, user, true);
        await sendTelegramAlert(task, user, true);
        await sendSMSAlert(task, user, true);

        taskDB.update(task.id, task.user_id, { reminder_sent: 1 });
      }

      // Send main alert when due
      if (!task.notified && task.due_date <= currentDate && task.due_time <= currentTime) {
        console.log(`Task due: ${task.title}`);

        // Send alerts
        await sendWhatsAppAlert(task, user);
        await sendTelegramAlert(task, user);
        await sendSMSAlert(task, user);

        // Mark as notified
        const alertCount = (task.alert_count || 0) + 1;
        taskDB.update(task.id, task.user_id, {
          notified: 1,
          alert_count: alertCount,
          last_alert_sent: now.toISOString()
        });

        // Handle recurring tasks
        if (task.recurring !== 'none') {
          const nextDate = calculateNextDate(task.due_date, task.recurring);

          // Get original subtasks and reset them
          const subtasks = task.subtasks || [];

          const newTaskResult = taskDB.create(task.user_id, {
            title: task.title,
            description: task.description,
            dueDate: nextDate,
            dueTime: task.due_time,
            recurring: task.recurring,
            priority: task.priority || 'medium',
            category: task.category || 'general',
            reminderMinutes: task.reminder_minutes || 0,
            notes: task.notes || ''
          });

          // Add subtasks for the new recurring task
          for (const subtask of subtasks) {
            subtaskDB.add(newTaskResult.lastInsertRowid, subtask.text);
          }
        }
      }

      // Alert escalation - repeat alert every 30 minutes if high priority and not completed
      if (task.notified && task.priority === 'high' && !task.completed && task.last_alert_sent) {
        const lastAlert = new Date(task.last_alert_sent);
        const minutesSinceLastAlert = (now - lastAlert) / 60000;

        if (minutesSinceLastAlert >= 30 && task.alert_count < 5) {
          console.log(`Escalation alert for high priority task: ${task.title} (attempt ${task.alert_count + 1})`);

          await sendWhatsAppAlert(task, user);
          await sendTelegramAlert(task, user);
          await sendSMSAlert(task, user);

          taskDB.update(task.id, task.user_id, {
            alert_count: task.alert_count + 1,
            last_alert_sent: now.toISOString()
          });
        }
      }
    }

    // Cleanup expired OTPs
    otpDB.cleanup();
  } catch (error) {
    console.error('Cron job error:', error.message);
  }
});

// Calculate next date for recurring tasks
function calculateNextDate(currentDate, recurring) {
  const date = new Date(currentDate);

  switch (recurring) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}

// API Routes

// ========== Authentication Routes ==========

// Check if user is authenticated
app.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.userId) {
    const user = userDB.findByPhone(req.session.phoneNumber);
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Send OTP for login/registration
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      return res.status(400).json({ error: 'Valid phone number required (E.164 format, e.g., +1234567890)' });
    }

    // Generate OTP
    const code = generateOTP();

    // Save OTP to database
    otpDB.create(phoneNumber, code);

    // Send OTP via SMS
    const sent = await sendOTPSMS(phoneNumber, code);

    if (sent) {
      res.json({ message: 'OTP sent successfully', phoneNumber });
    } else {
      // For development/testing - return OTP in response if SMS fails
      console.log(`OTP for ${phoneNumber}: ${code}`);
      res.json({
        message: 'OTP generated (SMS not configured)',
        phoneNumber,
        otp: code // Remove this in production
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP and login/register
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, code, name } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and OTP code required' });
    }

    // Verify OTP
    const isValid = otpDB.verify(phoneNumber, code);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Check if user exists
    let user = userDB.findByPhone(phoneNumber);

    if (!user) {
      // Register new user
      const result = userDB.create(phoneNumber, name || 'User', null);
      user = userDB.findByPhone(phoneNumber);
      console.log(`New user registered: ${phoneNumber}`);
    } else {
      // Update last login
      userDB.updateLastLogin(user.id);
    }

    // Create session
    req.session.userId = user.id;
    req.session.phoneNumber = user.phone_number;

    res.json({
      message: 'Authentication successful',
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get user alert preferences
app.get('/api/user/preferences', requireAuth, (req, res) => {
  try {
    const user = userDB.getAlertPreferences(req.session.userId);

    res.json({
      whatsapp_enabled: Boolean(user.whatsapp_enabled),
      telegram_enabled: Boolean(user.telegram_enabled),
      sms_enabled: Boolean(user.sms_enabled),
      browser_notifications_enabled: Boolean(user.browser_notifications_enabled),
      whatsapp_number: user.whatsapp_number,
      telegram_chat_id: user.telegram_chat_id,
      sms_number: user.sms_number
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user alert preferences
app.put('/api/user/preferences', requireAuth, (req, res) => {
  try {
    const {
      whatsapp_enabled,
      telegram_enabled,
      sms_enabled,
      browser_notifications_enabled,
      whatsapp_number,
      telegram_chat_id,
      sms_number
    } = req.body;

    userDB.updateAlertPreferences(req.session.userId, {
      whatsapp_enabled: whatsapp_enabled ? 1 : 0,
      telegram_enabled: telegram_enabled ? 1 : 0,
      sms_enabled: sms_enabled ? 1 : 0,
      browser_notifications_enabled: browser_notifications_enabled ? 1 : 0,
      whatsapp_number,
      telegram_chat_id,
      sms_number
    });

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Task Routes ==========

// Get all tasks
app.get('/api/tasks', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending tasks
app.get('/api/tasks/pending', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    const pendingTasks = tasks.filter(t => !t.completed);
    res.json(pendingTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new task
app.post('/api/tasks', requireAuth, (req, res) => {
  try {
    const {
      title, description, dueDate, dueTime, recurring,
      priority, category, reminderMinutes, notes, subtasks
    } = req.body;

    if (!title || !dueDate || !dueTime) {
      return res.status(400).json({ error: 'Title, date, and time are required' });
    }

    const result = taskDB.create(req.session.userId, {
      title,
      description,
      dueDate,
      dueTime,
      recurring,
      priority,
      category,
      reminderMinutes,
      notes
    });

    // Add subtasks if provided
    if (subtasks && Array.isArray(subtasks)) {
      for (const subtask of subtasks) {
        subtaskDB.add(result.lastInsertRowid, subtask.text);
      }
    }

    res.json({ id: result.lastInsertRowid, message: 'Task created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title, description, dueDate, dueTime, recurring, completed,
      priority, category, reminderMinutes, notes, subtasks
    } = req.body;

    // Verify task belongs to user
    const task = taskDB.getById(id, req.session.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update task
    taskDB.update(id, req.session.userId, {
      title,
      description,
      due_date: dueDate,
      due_time: dueTime,
      recurring,
      completed: completed ? 1 : 0,
      priority,
      category,
      reminder_minutes: reminderMinutes,
      notes
    });

    // Update subtasks - delete all and recreate
    if (subtasks && Array.isArray(subtasks)) {
      db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(id);
      for (const subtask of subtasks) {
        subtaskDB.add(id, subtask.text);
        if (subtask.completed && subtask.id) {
          subtaskDB.toggle(subtask.id);
        }
      }
    }

    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark task as complete
app.patch('/api/tasks/:id/complete', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = taskDB.complete(id, req.session.userId);

    if (result.changes > 0) {
      res.json({ message: 'Task marked as complete' });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = taskDB.delete(id, req.session.userId);

    if (result.changes > 0) {
      res.json({ message: 'Task deleted successfully' });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test WhatsApp
app.post('/api/test/whatsapp', requireAuth, async (req, res) => {
  if (!twilioClient) {
    return res.status(400).json({ error: 'WhatsApp not configured' });
  }

  try {
    const user = userDB.getAlertPreferences(req.session.userId);

    if (!user.whatsapp_number) {
      return res.status(400).json({ error: 'WhatsApp number not set in preferences' });
    }

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: user.whatsapp_number,
      body: '🔔 Test message from Todo Alert System!'
    });
    res.json({ message: 'WhatsApp test message sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Telegram
app.post('/api/test/telegram', requireAuth, async (req, res) => {
  if (!telegramBot) {
    return res.status(400).json({ error: 'Telegram not configured' });
  }

  try {
    const user = userDB.getAlertPreferences(req.session.userId);

    if (!user.telegram_chat_id) {
      return res.status(400).json({ error: 'Telegram chat ID not set in preferences' });
    }

    await telegramBot.sendMessage(
      user.telegram_chat_id,
      '🔔 Test message from Todo Alert System!'
    );
    res.json({ message: 'Telegram test message sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test SMS
app.post('/api/test/sms', requireAuth, async (req, res) => {
  if (!twilioClient) {
    return res.status(400).json({ error: 'SMS not configured. Check Twilio credentials' });
  }

  try {
    const user = userDB.getAlertPreferences(req.session.userId);

    if (!user.sms_number) {
      return res.status(400).json({ error: 'SMS number not set in preferences' });
    }

    await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.sms_number,
      body: '🔔 Test SMS from Todo Alert System!'
    });
    res.json({ message: 'SMS test message sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Snooze task
app.post('/api/tasks/:id/snooze', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { minutes } = req.body;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({ error: 'Minutes required (positive number)' });
    }

    const result = taskDB.snooze(id, req.session.userId, minutes);

    if (result.changes > 0) {
      const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
      res.json({ message: `Task snoozed for ${minutes} minutes`, snoozedUntil });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update subtask
app.patch('/api/tasks/:id/subtasks/:subtaskId', requireAuth, (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const subtaskId = parseInt(req.params.subtaskId);

    // Verify task belongs to user
    const task = taskDB.getById(taskId, req.session.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    subtaskDB.toggle(subtaskId);
    res.json({ message: 'Subtask updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task templates
app.get('/api/templates', async (req, res) => {
  const templates = [
    {
      id: 1,
      name: 'Daily Morning Routine',
      title: 'Morning Routine',
      description: 'Complete morning tasks',
      recurring: 'daily',
      dueTime: '08:00',
      priority: 'high',
      category: 'personal',
      subtasks: [
        { text: 'Wake up', completed: false },
        { text: 'Exercise', completed: false },
        { text: 'Breakfast', completed: false },
        { text: 'Review daily goals', completed: false }
      ]
    },
    {
      id: 2,
      name: 'Weekly Review',
      title: 'Weekly Planning',
      description: 'Review and plan the week',
      recurring: 'weekly',
      dueTime: '18:00',
      priority: 'medium',
      category: 'work',
      subtasks: [
        { text: 'Review last week', completed: false },
        { text: 'Set goals for next week', completed: false },
        { text: 'Schedule important meetings', completed: false }
      ]
    },
    {
      id: 3,
      name: 'Prayer Reminder',
      title: 'Prayer Time',
      description: 'Daily prayer',
      recurring: 'daily',
      priority: 'high',
      category: 'personal',
      reminderMinutes: 10
    },
    {
      id: 4,
      name: 'Medication Reminder',
      title: 'Take Medication',
      description: 'Daily medication',
      recurring: 'daily',
      priority: 'high',
      category: 'health',
      reminderMinutes: 15
    }
  ];

  res.json(templates);
});

// Statistics and Reports Endpoints

// Get overall statistics
app.get('/api/stats/summary', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    const now = new Date();

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed && !isOverdue(t, now)).length;
    const overdue = tasks.filter(t => !t.completed && isOverdue(t, now)).length;
    const notified = tasks.filter(t => t.notified).length;

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    res.json({
      total,
      completed,
      pending,
      overdue,
      notified,
      completionRate: parseFloat(completionRate)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily statistics
app.get('/api/stats/daily', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    const { days = 7 } = req.query;

    const stats = calculatePeriodStats(tasks, parseInt(days), 'day');
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weekly statistics
app.get('/api/stats/weekly', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    const { weeks = 4 } = req.query;

    const stats = calculatePeriodStats(tasks, parseInt(weeks), 'week');
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly statistics
app.get('/api/stats/monthly', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    const { months = 6 } = req.query;

    const stats = calculatePeriodStats(tasks, parseInt(months), 'month');
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get annual statistics
app.get('/api/stats/annual', requireAuth, (req, res) => {
  try {
    const tasks = taskDB.getAllByUser(req.session.userId);
    const { years = 2 } = req.query;

    const stats = calculatePeriodStats(tasks, parseInt(years), 'year');
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Check if task is overdue
function isOverdue(task, now) {
  const dueDate = task.due_date || task.dueDate;
  const dueTime = task.due_time || task.dueTime;
  const taskDateTime = new Date(`${dueDate}T${dueTime}`);
  return taskDateTime < now && !task.completed;
}

// Helper: Calculate statistics for a time period
function calculatePeriodStats(tasks, periods, unit) {
  const now = new Date();
  const results = [];

  for (let i = periods - 1; i >= 0; i--) {
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    if (unit === 'day') {
      periodStart.setDate(now.getDate() - i);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setDate(now.getDate() - i);
      periodEnd.setHours(23, 59, 59, 999);
    } else if (unit === 'week') {
      periodStart.setDate(now.getDate() - (i * 7));
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setDate(now.getDate() - ((i - 1) * 7) - 1);
      periodEnd.setHours(23, 59, 59, 999);
    } else if (unit === 'month') {
      periodStart.setMonth(now.getMonth() - i);
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setMonth(now.getMonth() - i + 1);
      periodEnd.setDate(0);
      periodEnd.setHours(23, 59, 59, 999);
    } else if (unit === 'year') {
      periodStart.setFullYear(now.getFullYear() - i);
      periodStart.setMonth(0, 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setFullYear(now.getFullYear() - i);
      periodEnd.setMonth(11, 31);
      periodEnd.setHours(23, 59, 59, 999);
    }

    const periodTasks = tasks.filter(task => {
      const createdAt = task.created_at || task.createdAt;
      const taskDate = new Date(createdAt);
      return taskDate >= periodStart && taskDate <= periodEnd;
    });

    const completed = periodTasks.filter(t => t.completed).length;
    const total = periodTasks.length;
    const overdue = periodTasks.filter(t => isOverdue(t, now)).length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    results.push({
      period: formatPeriodLabel(periodStart, unit),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      total,
      completed,
      pending: total - completed - overdue,
      overdue,
      completionRate: parseFloat(completionRate)
    });
  }

  return results;
}

// Helper: Format period label
function formatPeriodLabel(date, unit) {
  if (unit === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (unit === 'week') {
    return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else if (unit === 'month') {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (unit === 'year') {
    return date.getFullYear().toString();
  }
}

// Initialize and start server
app.listen(PORT, () => {
  console.log(`🚀 Todo Alert System (Multi-User) running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔐 Authentication: Enabled`);
  console.log(`💾 Database: SQLite`);
  console.log(`⏰ Task checker running every minute`);
  if (twilioClient) console.log('✅ Twilio configured (WhatsApp & SMS)');
  if (telegramBot) console.log('✅ Telegram configured');
});
