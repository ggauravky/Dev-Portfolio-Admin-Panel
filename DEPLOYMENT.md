# Deployment Guide

## Issue: "Failed to fetch" at login

This error occurs due to **CORS (Cross-Origin Resource Sharing)** misconfiguration between your Vercel frontend and Render backend.

## Solution

### On Render (Backend)

**CRITICAL:** You must set the `FRONTEND_URL` environment variable on Render to match your Vercel deployment URL.

1. Go to your Render dashboard: https://dashboard.render.com
2. Navigate to your service: **Dev-Portfolio-Admin-Panel**
3. Click on **Environment** in the left sidebar
4. Update/Add the following environment variable:
   - **Key:** `FRONTEND_URL`
   - **Value:** `https://ggauravkyadmin.vercel.app`

5. **Save** the changes
6. Render will automatically redeploy your service

### On Vercel (Frontend)

Ensure your environment variable is set correctly:

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project: **ggauravkyadmin**
3. Go to **Settings** → **Environment Variables**
4. Verify/Add:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://dev-portfolio-admin-panel.onrender.com/api/admin`

5. **Save** and **Redeploy** if needed

## Environment Variables Summary

### Render (Backend) - Required Variables:
```
PORT=5000
MONGO_URI=<your_mongodb_uri>
JWT_SECRET=<your_jwt_secret>
ADMIN_EMAIL=gkumaryadav526@gmail.com
ADMIN_PASSWORD=gaurava@portfolio.com#123
FRONTEND_URL=https://ggauravkyadmin.vercel.app
NODE_ENV=production
READ_ONLY_MODE=false
```

### Vercel (Frontend) - Required Variables:
```
VITE_API_URL=https://dev-portfolio-admin-panel.onrender.com/api/admin
```

## Testing After Deployment

1. Wait 1-2 minutes for Render to redeploy
2. Clear your browser cache or open an incognito window
3. Visit: https://ggauravkyadmin.vercel.app/
4. Try logging in with your admin credentials
5. Check browser console (F12) for any remaining errors

## Common Issues

### Still getting "Failed to fetch"?
- Verify the `FRONTEND_URL` on Render exactly matches: `https://ggauravkyadmin.vercel.app` (no trailing slash)
- Check Render logs for CORS errors
- Ensure your backend service is running on Render
- Test the API directly: https://dev-portfolio-admin-panel.onrender.com/

### CORS errors in browser console?
- Double-check the `FRONTEND_URL` on Render
- Ensure there are no typos in the URL
- Wait for Render to finish redeploying

### API not responding?
- Check if your Render service is running
- Verify MongoDB connection string is correct
- Check Render logs for errors
