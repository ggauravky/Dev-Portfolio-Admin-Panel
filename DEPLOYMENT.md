# Deployment Guide

## Backend Deployment (Render)

### Steps:

1. **Create a new Web Service on Render**

   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings**

   - **Name**: portfolio-admin-backend
   - **Root Directory**: `server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Set Environment Variables**
   Go to "Environment" tab and add:

   ```
   PORT=5000
   MONGO_URI=mongodb+srv://sohan119singh_db_user:pG60MR2helJOSBz6@cluster0.enthnc5.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=portfolio_admin_jwt_secret_key_2026_32_chars_minimum
   ADMIN_EMAIL=admin@portfolio.com
   ADMIN_PASSWORD=Admin@123
   FRONTEND_URL=https://your-vercel-app.vercel.app
   NODE_ENV=production
   READ_ONLY_MODE=false
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Copy your backend URL (e.g., `https://portfolio-admin-backend.onrender.com`)

---

## Frontend Deployment (Vercel)

### Steps:

1. **Deploy to Vercel**

   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your GitHub repository

2. **Configure Project Settings**

   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Set Environment Variables**
   Go to "Settings" → "Environment Variables" and add:

   ```
   VITE_API_URL=https://your-render-backend.onrender.com/api/admin
   ```

   Replace `your-render-backend.onrender.com` with your actual Render backend URL.

4. **Deploy**

   - Click "Deploy"
   - Wait for deployment to complete
   - Copy your frontend URL

5. **Update Backend CORS**
   - Go back to Render dashboard
   - Update `FRONTEND_URL` environment variable with your Vercel URL
   - Redeploy the backend service

---

## Post-Deployment Steps

1. **Test the Application**

   - Visit your Vercel frontend URL
   - Try logging in with: `admin@portfolio.com` / `Admin@123`
   - Test all CRUD operations

2. **MongoDB Atlas Network Access**

   - Go to MongoDB Atlas
   - Navigate to "Network Access"
   - Add IP address `0.0.0.0/0` to allow connections from anywhere (or add Render's IP addresses)

3. **Update Credentials (Recommended)**
   - Change the default admin password
   - Rotate JWT secret for production

---

## Environment Variables Summary

### Backend (Render)

| Variable         | Description                       | Example                       |
| ---------------- | --------------------------------- | ----------------------------- |
| `PORT`           | Server port                       | `5000`                        |
| `MONGO_URI`      | MongoDB connection string         | `mongodb+srv://...`           |
| `JWT_SECRET`     | JWT signing secret (min 32 chars) | `your_secret_key`             |
| `ADMIN_EMAIL`    | Admin login email                 | `admin@portfolio.com`         |
| `ADMIN_PASSWORD` | Admin login password              | `Admin@123`                   |
| `FRONTEND_URL`   | Frontend URL for CORS             | `https://your-app.vercel.app` |
| `NODE_ENV`       | Environment                       | `production`                  |
| `READ_ONLY_MODE` | Enable/disable writes             | `false`                       |

### Frontend (Vercel)

| Variable       | Description          | Example                                       |
| -------------- | -------------------- | --------------------------------------------- |
| `VITE_API_URL` | Backend API endpoint | `https://your-backend.onrender.com/api/admin` |

---

## Troubleshooting

### CORS Errors

- Ensure `FRONTEND_URL` in Render matches your Vercel URL exactly
- Redeploy backend after updating CORS settings

### Database Connection Issues

- Check MongoDB Atlas Network Access settings
- Verify `MONGO_URI` is correct and accessible

### Build Failures

- Check build logs in Render/Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### API Connection Issues

- Verify `VITE_API_URL` in Vercel is correct
- Check backend is running on Render
- Test backend health endpoint: `https://your-backend.onrender.com/`

---

## Free Tier Limitations

### Render Free Plan

- Services spin down after 15 minutes of inactivity
- First request may take 30-60 seconds (cold start)
- 750 hours/month free

### Vercel Free Plan

- 100 GB bandwidth/month
- Unlimited deployments
- Custom domains supported

---

## Monitoring

### Backend Health Check

```bash
curl https://your-backend.onrender.com/
```

Should return:

```json
{ "message": "Admin API running", "status": "ok" }
```

### Frontend

Visit your Vercel URL and check browser console for any errors.
