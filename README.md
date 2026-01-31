# 🔔 Todo Alert System

A powerful, multi-user task management system with smart alerts via WhatsApp, Telegram, and SMS. Never miss a deadline again!

## ✨ Features

### Core Functionality
- ✅ **Multi-User Support** - Phone number authentication with OTP
- ✅ **Smart Alerts** - WhatsApp, Telegram, SMS, and browser notifications
- ✅ **Task Management** - Create, edit, complete, and delete tasks
- ✅ **Recurring Tasks** - Daily, weekly, and monthly repetition
- ✅ **Priority Levels** - High, Medium, Low with color coding
- ✅ **Categories** - Work, Personal, Health, Shopping, Study, Finance
- ✅ **Early Reminders** - Get notified 5-60 minutes before due time
- ✅ **Snooze Functionality** - Postpone alerts when you need more time
- ✅ **Subtasks** - Break down complex tasks into smaller steps
- ✅ **Task Notes** - Add detailed descriptions and context

### Advanced Features
- 🎨 **Dark/Light Mode** - Easy on your eyes, day or night
- 🔍 **Search & Filter** - Find tasks quickly
- 📊 **Reports & Statistics** - Track your productivity
- 🎯 **Task Templates** - Quick-add common recurring tasks
- 🔄 **Bulk Actions** - Complete or delete multiple tasks at once
- 🎭 **Drag & Drop** - Reorder tasks visually
- 🚨 **Alert Escalation** - Repeat alerts for high-priority incomplete tasks
- ⚙️ **Per-User Settings** - Each user controls their own alert preferences

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up API Credentials

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Then configure your API credentials (see setup guides below).

### 3. Run the App

```bash
npm start
```

Open http://localhost:3000 in your browser!

### 4. First-Time Setup

1. You'll be redirected to the login page
2. Enter your phone number and name
3. Verify with the OTP code sent to your phone
4. Configure your alert preferences in Settings
5. Start adding tasks!

## 🔑 API Setup Guides

### WhatsApp Setup (via Twilio)

Twilio provides a **FREE** sandbox for WhatsApp testing!

1. **Sign up for Twilio**
   - Go to: https://www.twilio.com/try-twilio
   - Sign up (free account)

2. **Get WhatsApp Sandbox**
   - In Twilio Console, go to **Messaging** → **Try it out** → **Send a WhatsApp message**
   - You'll see a sandbox number: `whatsapp:+14155238886`
   - Follow instructions to connect your WhatsApp to the sandbox (send a code)

3. **Get Credentials**
   - Go to Twilio Console Dashboard
   - Copy your **Account SID** and **Auth Token**

4. **Add to `.env`**
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   YOUR_WHATSAPP_NUMBER=whatsapp:+1234567890
   ```

   **Note:** Your WhatsApp number must include country code (e.g., `whatsapp:+1234567890`)

### Telegram Setup (100% FREE!)

Telegram bots are completely free, no credit card required!

1. **Create a Bot**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot`
   - Choose a name (e.g., "My Todo Bot")
   - Choose a username (e.g., "mytodo_alert_bot")
   - Copy the **Bot Token** (looks like: `123456:ABC-DEF...`)

2. **Get Your Chat ID**
   - Search for `@userinfobot` on Telegram
   - Start a chat with it
   - It will send you your **Chat ID** (a number)

3. **Add to `.env`**
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```

4. **Start Your Bot**
   - Search for your bot by username in Telegram
   - Send `/start` to activate it

## 🤖 Telegram Bot Setup

The Telegram bot is now used for receiving alerts and getting your Chat ID:

1. Search for your bot by username in Telegram
2. Send `/start` to activate it
3. The bot will reply with your **Chat ID**
4. Copy this Chat ID
5. Go to Settings in the web dashboard
6. Paste your Chat ID in the Telegram settings
7. Enable Telegram alerts and save

You'll now receive task alerts on Telegram!

## 📖 Usage

### First-Time User Registration

1. **Register/Login**
   - Visit the app URL
   - Enter your phone number (E.164 format: +1234567890)
   - Enter your name (optional)
   - Click "Send Verification Code"
   - Enter the 6-digit OTP sent to your phone
   - Click "Verify & Login"

2. **Configure Alert Preferences** (Settings Page)
   - Click "Settings" in the header
   - Enable desired alert channels:
     - **WhatsApp**: Enter your WhatsApp number (format: `whatsapp:+1234567890`)
     - **Telegram**: Enter your Chat ID (get from bot)
     - **SMS**: Enter your phone number (format: `+1234567890`)
     - **Browser Notifications**: Toggle on to enable
   - Click "Test" buttons to verify each channel
   - Save preferences

### Web Dashboard Features

1. **Add Tasks**
   - Fill in task details (title, description, date, time)
   - Set **priority** (High/Medium/Low)
   - Choose **category** (Work, Personal, Health, etc.)
   - Set **recurring** (One-time, Daily, Weekly, Monthly)
   - Add **early reminder** (5-60 minutes before)
   - Add **notes** for context
   - Add **subtasks** to break down complex tasks
   - Or use a **template** for common tasks

2. **Search & Filter**
   - Use search box to find tasks by title/description
   - Filter by recurring type
   - Sort by date, title, or created date

3. **Bulk Actions**
   - Click "Bulk Select" to enter bulk mode
   - Check multiple tasks
   - Use "Complete" or "Delete" buttons for selected tasks

4. **Edit Tasks**
   - Click "Edit" on any task card
   - Modify any task details
   - Update subtasks
   - Save changes

5. **Snooze Tasks**
   - Click "Snooze" on a task card
   - Enter minutes to postpone
   - Alert will repeat after snooze period

6. **View Reports**
   - See overall statistics (total, completed, overdue)
   - View daily, weekly, or monthly trends
   - Track completion rates

### How Alerts Work

- The system checks for due tasks **every minute**
- **Early Reminders**: Get notified X minutes before due time (if configured)
- **Main Alert**: When task is due, alerts sent to all enabled channels:
  - ✅ WhatsApp (if enabled in your settings)
  - ✅ Telegram (if enabled in your settings)
  - ✅ SMS (if enabled in your settings)
  - ✅ Browser (if enabled and browser is open)
- **Alert Escalation**: High-priority tasks repeat alerts every 30 minutes (up to 5 times)
- **Recurring Tasks**: Automatically creates next occurrence after alerting

## 📁 Project Structure

```
todo-alert-system/
├── server.js           # Express server, API routes, scheduler
├── database.js         # Database layer (SQLite)
├── todo-alert.db       # SQLite database (auto-created)
├── package.json        # Dependencies
├── .env                # Your API credentials (not in git)
├── .env.example        # Template for environment variables
├── Procfile           # Heroku deployment config
├── railway.json       # Railway deployment config
├── render.yaml        # Render deployment config
├── DEPLOYMENT.md      # Comprehensive deployment guide
├── public/
│   ├── index.html      # Main dashboard
│   ├── login.html      # Login/registration page
│   ├── settings.html   # User settings page
│   ├── styles.css      # Modern CSS with dark mode
│   └── app.js          # Frontend JavaScript
└── README.md           # This file
```

## 🔧 Configuration

### Timezone

By default, the system uses your server's timezone. To set a specific timezone, add to `.env`:

```env
TIMEZONE=America/New_York
```

### Port

Change the server port:

```env
PORT=3000
```

## 🌐 Deployment

Deploy your Todo Alert System to the cloud so it's accessible from anywhere!

### Quick Deploy Options

**Railway** (Recommended - Free Tier)
```bash
# Quick deploy
railway up
```

**Render** (Free Tier with Persistent Storage)
- Connect GitHub repo
- Auto-deploy on push

**Heroku** (Paid Plans)
- Mature platform
- Extensive add-ons

### Complete Deployment Guide

For detailed step-by-step instructions for all platforms, see **[DEPLOYMENT.md](DEPLOYMENT.md)**

The deployment guide includes:
- ✅ Environment variable setup
- ✅ Platform-specific instructions
- ✅ Database considerations
- ✅ Post-deployment setup
- ✅ Troubleshooting tips
- ✅ Security best practices
- ✅ Monitoring and logs

### Run Locally (Development)

For development with auto-reload:
```bash
npm run dev
```

For production locally:
```bash
npm start
```

## 🛠️ Development

Run with auto-reload:
```bash
npm run dev
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone number
- `POST /api/auth/verify-otp` - Verify OTP and login/register
- `GET /api/auth/check` - Check authentication status
- `POST /api/auth/logout` - Logout user

### Tasks
- `GET /api/tasks` - Get all user tasks (auth required)
- `GET /api/tasks/pending` - Get pending tasks only (auth required)
- `POST /api/tasks` - Create new task (auth required)
- `PUT /api/tasks/:id` - Update task (auth required)
- `PATCH /api/tasks/:id/complete` - Mark task complete (auth required)
- `DELETE /api/tasks/:id` - Delete task (auth required)
- `POST /api/tasks/:id/snooze` - Snooze task (auth required)
- `PATCH /api/tasks/:id/subtasks/:id` - Toggle subtask (auth required)

### User Preferences
- `GET /api/user/preferences` - Get user alert preferences (auth required)
- `PUT /api/user/preferences` - Update alert preferences (auth required)

### Testing
- `POST /api/test/whatsapp` - Send test WhatsApp (auth required)
- `POST /api/test/telegram` - Send test Telegram (auth required)
- `POST /api/test/sms` - Send test SMS (auth required)

### Statistics
- `GET /api/stats/summary` - Overall statistics (auth required)
- `GET /api/stats/daily` - Daily statistics (auth required)
- `GET /api/stats/weekly` - Weekly statistics (auth required)
- `GET /api/stats/monthly` - Monthly statistics (auth required)

### Templates
- `GET /api/templates` - Get task templates (auth required)

## 🆓 Cost Breakdown

- **Telegram**: 100% FREE forever
- **WhatsApp (Twilio Free Tier)**:
  - Free sandbox for testing
  - Paid plans start at $0.005 per message
- **Hosting**:
  - Railway: Free tier available
  - Render: Free tier available
  - Heroku: Free dyno (limited hours)

## 🐛 Troubleshooting

### WhatsApp not working
- Make sure you've joined the Twilio sandbox (sent the code via WhatsApp)
- Check that your phone number includes country code
- Verify Account SID and Auth Token are correct

### Telegram not working
- Make sure you've started a chat with your bot (`/start`)
- Verify Bot Token is correct
- Check that Chat ID is a number, not username

### Tasks not alerting
- Check server logs for errors
- Verify task due date/time is in the future
- Make sure server is running

## 📄 License

MIT License - feel free to use for personal or commercial projects!

## 🤝 Contributing

Feel free to open issues or submit pull requests!

---

Built with ❤️ for staying organized and never missing important tasks!
