# 🚨 URGENT FIX: "Failed to fetch" Error

## Current Issue

Your login is failing with "Failed to fetch" because **CORS is blocking** requests from Vercel to Render.

## ✅ SOLUTION (2 minutes)

### Step 1: Update Render Environment Variables

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Select Service**: `Dev-Portfolio-Admin-Panel`
3. **Click**: Environment (left sidebar)
4. **Add/Update these variables**:

```bash
FRONTEND_URL=https://ggauravkyadmin.vercel.app
ADMIN_EMAIL=gkumaryadav526@gmail.com
ADMIN_PASSWORD=gaurav@portfolio.com#123
```

5. **IMPORTANT**: Make sure there's NO trailing slash in FRONTEND_URL
6. **Save Changes** - Render will auto-redeploy (takes 1-2 min)

### Step 2: Verify Vercel Environment Variables

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select Project**: Your portfolio admin project
3. **Settings** → **Environment Variables**
4. **Verify**:

```bash
VITE_API_URL=https://dev-portfolio-admin-panel.onrender.com/api/admin
```

5. **Redeploy** if you made changes

### Step 3: Test the Connection

After Render redeploys (~2 minutes):

**Option A - Use Test Tool** (Recommended):

1. Open `test-api.html` in your browser
2. Click "1. Test Health Check"
3. Click "2. Test Login"
4. This will show you exactly what's wrong

**Option B - Test Live Site**:

1. Clear browser cache (Ctrl+Shift+Delete)
2. Go to: https://ggauravkyadmin.vercel.app
3. Try logging in with:
   - Email: `gkumaryadav526@gmail.com`
   - Password: `gaurav@portfolio.com#123`

## 🔍 Debugging Guide

### Check Render Logs

1. Render Dashboard → Your Service → Logs
2. Look for:
   - `CORS blocked origin: https://ggauravkyadmin.vercel.app`
   - `Allowed origins: ...`

### Check Browser Console

1. Press F12 in browser
2. Go to Console tab
3. Look for CORS errors (red text)

### Still Not Working?

**Common Issues:**

1. **FRONTEND_URL has typo or trailing slash**

   - ❌ Wrong: `https://ggauravkyadmin.vercel.app/`
   - ✅ Correct: `https://ggauravkyadmin.vercel.app`

2. **Render service hasn't redeployed**

   - Wait 2-3 minutes after saving env vars
   - Check Render logs to confirm deployment

3. **Browser cached old requests**

   - Clear cache or use Incognito mode

4. **Backend server is sleeping (Render free tier)**
   - First request may take 30-60 seconds
   - Try again after waiting

## 📋 Complete Environment Variables Checklist

### Render (Backend):

- [ ] `PORT=5000`
- [ ] `MONGO_URI=mongodb+srv://...` (your connection string)
- [ ] `JWT_SECRET=portfolio_admin_jwt_secret_key_2026_32_chars_minimum`
- [ ] `ADMIN_EMAIL=gkumaryadav526@gmail.com`
- [ ] `ADMIN_PASSWORD=gaurav@portfolio.com#123`
- [ ] `FRONTEND_URL=https://ggauravkyadmin.vercel.app` ⚠️ **CRITICAL**
- [ ] `NODE_ENV=production`
- [ ] `READ_ONLY_MODE=false`

### Vercel (Frontend):

- [ ] `VITE_API_URL=https://dev-portfolio-admin-panel.onrender.com/api/admin`

## 🎯 Quick Test Commands

Test backend health:

```bash
curl https://dev-portfolio-admin-panel.onrender.com/
```

Expected response:

```json
{ "message": "Admin API running", "status": "ok" }
```

Test login:

```bash
curl -X POST https://dev-portfolio-admin-panel.onrender.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gkumaryadav526@gmail.com","password":"gaurav@portfolio.com#123"}'
```

Expected response:

```json
{ "token": "eyJhbGc...", "message": "Login successful" }
```

## 🆘 Need More Help?

1. Open `test-api.html` in browser for detailed diagnostics
2. Check Render logs for CORS messages
3. Verify all environment variables are set correctly
4. Make sure Render service has finished redeploying

---

**After fixing**, commit and push changes:

```bash
git add .
git commit -m "fix: improve error handling for CORS issues"
git push origin main
```
