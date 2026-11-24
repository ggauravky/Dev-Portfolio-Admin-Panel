<div align="center">

# 🎯 Portfolio Admin Panel

### Powerful Admin Dashboard for Portfolio Management

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-blue?style=for-the-badge&logo=vercel)](https://ggauravkyadmin.vercel.app/)
[![Portfolio](https://img.shields.io/badge/Portfolio-View%20Site-green?style=for-the-badge&logo=vercel)](https://ggauravky.vercel.app/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

**Stop struggling with slow database queries and clunky interfaces!** 🚀

This admin panel transforms your portfolio management experience with lightning-fast data access, intuitive filtering, and professional CRUD operations.

[Features](#-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Deployment](#-deployment) • [Screenshots](#-screenshots)

</div>

---

## 🎭 The Problem

Managing portfolio data through MongoDB directly or basic tools is:

- ❌ **Slow** - Waiting for database queries to load
- ❌ **Inefficient** - No proper filtering or search capabilities
- ❌ **Clunky** - Poor user experience for data management
- ❌ **Time-consuming** - Manual data operations take forever

## ✨ The Solution

A modern, blazing-fast admin panel that gives you:

- ✅ **Instant Access** - View all contact messages and newsletter subscriptions in seconds
- ✅ **Smart Filtering** - Powerful search, sort, and filter capabilities
- ✅ **Full Control** - Complete CRUD operations with intuitive UI
- ✅ **Professional Dashboard** - Beautiful analytics and data visualization
- ✅ **Secure** - Revocable administrator sessions with protected routes

---

## 🌟 Features

<table>
<tr>
<td width="50%">

### 📊 Dashboard Analytics

- Real-time statistics
- Contact & subscription counts
- Visual data representation
- Quick access metrics

### Financial Control Center

- Read-only Razorpay transactions, bookings, receipts, webhook events and reconciliation
- Seven-day dashboard snapshot with separate checkout and paid-date reporting
- [Financial data contracts and operating limits](docs/admin-financial-control-phase-5.md)

### Business operations

- Registered users, contact inbox, newsletter subscriptions, and blog engagement
- Recorded user activity, administrator audit and sessions, and system health
- [Business reporting definitions and access policy](docs/admin-business-operations-phase-6.md)

### 📬 Contact Management

- View all contact messages
- Advanced search & filtering
- Sort by date, name, or email
- Read/Unread status tracking
- Bulk operations support

</td>
<td width="50%">

### 📰 Newsletter Management

- Subscriber list with details
- Email verification status
- Subscription date tracking
- Export capabilities
- Easy subscriber management

### 🔐 Security & Auth

- Argon2id administrator credentials and server-managed sessions
- Protected admin routes
- Session management
- Role-based access control

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

### Frontend

| Technology                                                                                                     | Purpose    |
| -------------------------------------------------------------------------------------------------------------- | ---------- |
| ![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)                      | UI Library |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)                         | Build Tool |
| ![TailwindCSS](https://img.shields.io/badge/Tailwind-38B2AC?style=flat&logo=tailwind-css&logoColor=white)      | Styling    |
| ![React Router](https://img.shields.io/badge/React_Router-CA4245?style=flat&logo=react-router&logoColor=white) | Routing    |

### Backend

| Technology                                                                                      | Purpose        |
| ----------------------------------------------------------------------------------------------- | -------------- |
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white) | Runtime        |
| ![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white) | Web Framework  |
| ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white) | Database       |
| Argon2id and MongoDB sessions | Authentication |

### Deployment

| Service                                                                                      | Purpose          |
| -------------------------------------------------------------------------------------------- | ---------------- |
| ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white) | Frontend Hosting |
| ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=white) | Backend Hosting  |

---

## 🚀 Quick Start

### Prerequisites

```bash
node >= 14.x
npm >= 6.x
MongoDB Atlas account (or local MongoDB)
```

### 📥 Installation

1. **Clone the repository**

```bash
git clone https://github.com/ggauravky/Dev-Portfolio-Admin-Panel.git
cd Dev-Portfolio-Admin-Panel
```

2. **Install Frontend Dependencies**

```bash
npm install
```

3. **Install Backend Dependencies**

```bash
cd server
npm install
```

4. **Setup Environment Variables**

The Vite development server proxies `/api/admin` to the backend on port 5000. Copy [server/.env.example](server/.env.example) to the ignored `server/.env`. Generate credentials and provision the isolated Admin database using the [authentication setup guide](docs/admin-auth-phase-3.md).

5. **Run Development Servers**

**Terminal 1 - Backend:**

```bash
cd server
npm start
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

6. **Access the Application**

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## 📦 Project Structure

```
Portfolio-Admin-Panel/
├── 📁 src/                      # Frontend source code
│   ├── 📁 components/          # Reusable React components
│   │   └── AdminLayout.jsx     # Admin layout wrapper
│   ├── 📁 pages/               # Page components
│   │   └── 📁 admin/
│   │       ├── Dashboard.jsx   # Analytics dashboard
│   │       ├── Contacts.jsx    # Contact management
│   │       ├── Newsletter.jsx  # Newsletter management
│   │       └── Login.jsx       # Authentication
│   ├── 📁 routes/              # Route configuration
│   ├── 📁 services/            # API services
│   │   └── api.js              # API integration
│   └── App.jsx                 # Main app component
│
├── 📁 server/                   # Backend source code
│   ├── 📁 auth/                # Credentials and session storage
│   ├── 📁 config/              # Runtime configuration and MongoDB pools
│   ├── 📁 repositories/        # Portfolio read projections
│   ├── 📁 routes/              # API routes
│   │   └── adminRoutes.js      # Admin endpoints
│   └── server.js               # Express server
│
├── 📄 package.json             # Frontend dependencies
├── 📄 vite.config.js           # Vite configuration
├── 📄 tailwind.config.js       # Tailwind configuration
└── 📄 vercel.json              # Vercel deployment config
```

---

## 🌐 Deployment

Deploy the frontend and its same-origin API Function on Vercel. Deploy the Express backend from `server/` on Render. The [authentication rollout guide](docs/admin-auth-phase-3.md) lists the paired environment variables, MongoDB permissions, verification, and rollback steps.

---

## 🔐 Security Features

| Feature                      | Description                           |
| ---------------------------- | ------------------------------------- |
| 🔒 **Administrator Sessions** | HttpOnly cookies and revocable server-side sessions |
| 🛡️ **Protected Routes**      | Frontend and backend route protection |
| 🔑 **Environment Variables** | Sensitive data stored securely        |
| 🚫 **CORS Configuration**    | Whitelist trusted origins only        |
| ⏰ **Session Expiration**    | Idle and absolute expiry             |
| 🔐 **Helmet.js**             | Security headers protection           |

---

## 📸 Screenshots

### Dashboard

> Analytics overview with real-time statistics

### Contact Management

> View, filter, and manage all contact form submissions

### Newsletter Management

> Handle newsletter subscriptions with ease

_Screenshots coming soon!_

---

## 🎯 Use Cases

This admin panel is perfect for:

- 📧 **Freelance Developers** - Manage client inquiries efficiently
- 💼 **Portfolio Owners** - Track visitor engagement and messages
- 🎨 **Creative Professionals** - Organize contact requests
- 🚀 **Startups** - Manage early-stage user communications
- 📊 **Marketing Teams** - Track newsletter growth and engagement

---

## 🔧 Available Scripts

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend

```bash
npm start            # Start production server
npm run dev          # Start with nodemon (auto-reload)
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🍴 Fork the repository
2. 🔨 Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. ✅ Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🎉 Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Gaurav Kumar Yadav**

- 🌐 Portfolio: [ggauravky.vercel.app](https://ggauravky.vercel.app/)
- 💼 LinkedIn: [linkedin.com/in/gauravky](https://www.linkedin.com/in/gauravky/)
- 🐙 GitHub: [@ggauravky](https://github.com/ggauravky)
- 📸 Instagram: [@the_gau_rav](https://www.instagram.com/the_gau_rav/)
- 💻 LeetCode: [gauravky](https://leetcode.com/u/gauravky/)
- 🎯 GeeksforGeeks: [gauravky](https://www.geeksforgeeks.org/profile/gauravky)

---

## 🙏 Acknowledgments

- React.js community for excellent documentation
- TailwindCSS for beautiful utility-first styling
- MongoDB Atlas for reliable database hosting
- Vercel & Render for seamless deployment

---

<div align="center">

### ⭐ Found this helpful? Give it a star!

Made with ❤️ by [Gaurav Kumar Yadav](https://github.com/ggauravky)

**[⬆ Back to Top](#-portfolio-admin-panel)**

</div>
