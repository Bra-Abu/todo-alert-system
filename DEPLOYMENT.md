# Todo Alert System - Deployment Guide

This guide will help you deploy the Todo Alert System to popular cloud platforms.

## Prerequisites

Before deploying, ensure you have:

1. **Twilio Account** (for WhatsApp & SMS alerts)
   - Sign up at [twilio.com](https://www.twilio.com)
   - Get your Account SID and Auth Token
   - Set up a phone number for SMS
   - Activate WhatsApp Sandbox for testing

2. **Telegram Bot** (for Telegram alerts)
   - Create a bot using [@BotFather](https://t.me/botfather)
   - Get your Bot Token

3. **Git Repository**
   - Push your code to GitHub, GitLab, or Bitbucket

## Environment Variables

All platforms require these environment variables:

```
PORT=3000
NODE_ENV=production
SESSION_SECRET=<generate-a-strong-random-string>
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
```

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Option 1: Deploy to Railway

Railway is recommended for its simplicity and generous free tier.

### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Environment Variables**
   - Go to your project
   - Click "Variables"
   - Add all environment variables listed above

4. **Deploy**
   - Railway will automatically detect Node.js and deploy
   - Your app will be available at `https://your-app.railway.app`

5. **Add Custom Domain (Optional)**
   - Go to "Settings" > "Domains"
   - Add your custom domain

### Railway Features:
- ✅ Automatic HTTPS
- ✅ Automatic deployments on git push
- ✅ Free tier: $5 credit/month
- ✅ Persistent SQLite database

---

## Option 2: Deploy to Render

Render offers a reliable free tier with persistent storage.

### Steps:

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" > "Web Service"
   - Connect your repository
   - Configure:
     - **Name**: todo-alert-system
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
     - **Plan**: Free

3. **Add Environment Variables**
   - Scroll to "Environment Variables"
   - Add all required variables
   - Use "Generate" for SESSION_SECRET

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy
   - Your app will be at `https://your-app.onrender.com`

### Render Features:
- ✅ Automatic HTTPS
- ✅ Auto-deploy on git push
- ✅ Free tier with persistent disk
- ✅ Sleep after 15 min inactivity (free tier)

**Note**: Free tier services sleep after inactivity. First request may take 30-60 seconds.

---

## Option 3: Deploy to Heroku

Heroku is a mature platform with extensive documentation.

### Steps:

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku

   # Windows
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   cd todo-alert-system
   heroku create your-app-name
   ```

4. **Add Buildpack**
   ```bash
   heroku buildpacks:set heroku/nodejs
   ```

5. **Set Environment Variables**
   ```bash
   heroku config:set PORT=3000
   heroku config:set NODE_ENV=production
   heroku config:set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   heroku config:set TWILIO_ACCOUNT_SID=your_account_sid
   heroku config:set TWILIO_AUTH_TOKEN=your_auth_token
   heroku config:set TWILIO_PHONE_NUMBER=your_phone_number
   heroku config:set TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   heroku config:set TELEGRAM_BOT_TOKEN=your_bot_token
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

7. **Open Your App**
   ```bash
   heroku open
   ```

### Heroku Features:
- ✅ Mature ecosystem
- ✅ Extensive add-ons
- ⚠️ Free tier discontinued (requires paid plan)
- ⚠️ Ephemeral filesystem (database resets on restart)

**Note**: For persistent database on Heroku, consider using a PostgreSQL add-on instead of SQLite.

---

## Post-Deployment Setup

After deploying to any platform:

### 1. Create Your Account
- Visit your deployed URL
- You'll be redirected to the login page
- Enter your phone number and name
- Verify with OTP

### 2. Configure Alert Preferences
- Click "Settings" in the header
- Enable desired alert channels:
  - **WhatsApp**: Enter your WhatsApp number (format: `whatsapp:+1234567890`)
  - **Telegram**: Get chat ID from your bot (send `/start` to your bot)
  - **SMS**: Enter your phone number (format: `+1234567890`)
- Test each channel
- Save preferences

### 3. Add Your First Task
- Go to Dashboard
- Fill in task details
- Select priority, category, and reminder time
- Submit and wait for alerts!

---

## Database Considerations

### SQLite (Default)
- ✅ Simple, no setup required
- ✅ Works on Railway and Render
- ⚠️ Not suitable for Heroku free tier (ephemeral filesystem)
- ⚠️ Limited to single instance

### PostgreSQL (Recommended for Production)
If you expect high traffic or need multi-instance deployment:

1. Add PostgreSQL database (all platforms offer this)
2. Install pg: `npm install pg`
3. Update `database.js` to use PostgreSQL instead of SQLite
4. Migrate schema to PostgreSQL

---

## Monitoring & Logs

### Railway
```bash
railway logs
```

### Render
- Dashboard > Logs tab

### Heroku
```bash
heroku logs --tail
```

---

## Troubleshooting

### Issue: OTP not received

**Solution**:
- Check Twilio credentials
- Verify phone number format (E.164)
- Check Twilio console for SMS logs

### Issue: WhatsApp not working

**Solution**:
- Confirm WhatsApp Sandbox is active
- Join sandbox: Send "join <code>" to WhatsApp number
- Verify sender number format includes `whatsapp:` prefix

### Issue: Database resets on restart (Heroku)

**Solution**:
- Heroku's free tier has ephemeral filesystem
- Upgrade to paid dyno with persistent storage
- Or migrate to PostgreSQL

### Issue: App sleeping (Render free tier)

**Solution**:
- Free tier sleeps after 15 min inactivity
- Upgrade to paid plan
- Or use a service like UptimeRobot to ping every 10 minutes

---

## Security Best Practices

1. **Never commit `.env` file** - Always use `.gitignore`
2. **Use strong SESSION_SECRET** - Generate randomly
3. **Enable HTTPS** - All platforms provide this by default
4. **Rotate Twilio credentials periodically**
5. **Use environment-specific credentials** (separate for dev/prod)

---

## Scaling

For high traffic:

1. **Upgrade to paid tier** for more resources
2. **Use PostgreSQL** instead of SQLite
3. **Add Redis** for session storage (better than memory)
4. **Enable horizontal scaling** (multiple instances)
5. **Use queue** for SMS/WhatsApp (e.g., Bull with Redis)

---

## Need Help?

- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Render**: [render.com/docs](https://render.com/docs)
- **Heroku**: [devcenter.heroku.com](https://devcenter.heroku.com)
- **Twilio**: [twilio.com/docs](https://www.twilio.com/docs)
- **Telegram Bots**: [core.telegram.org/bots](https://core.telegram.org/bots)

---

## Quick Command Reference

```bash
# Railway
railway login
railway link
railway up
railway logs

# Render (via Dashboard only)

# Heroku
heroku login
heroku create app-name
heroku config:set KEY=VALUE
git push heroku main
heroku logs --tail
heroku restart
```

---

**Congratulations!** 🎉 Your Todo Alert System is now live and accessible to users worldwide!
