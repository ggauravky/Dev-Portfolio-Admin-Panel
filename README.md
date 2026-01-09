# Portfolio Admin Panel

A simple admin panel to manage contact messages and newsletter subscriptions from my portfolio website.

## Tech Stack

**Frontend:**

- React (Vite)
- Tailwind CSS
- React Router

**Backend:**

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication

## Features

- Admin login with JWT
- Dashboard with stats
- View all contact messages
- View all newsletter subscriptions
- Clean table UI
- Mobile responsive

## Setup Instructions

### Backend Setup

1. Navigate to the server folder:

```bash
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

4. Update `.env` with your values:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key_here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
```

5. Start the server:

```bash
npm run dev
```

Server will run on `http://localhost:5000`

### Frontend Setup

1. From the root folder, install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## Usage

1. Navigate to `http://localhost:3000/admin/login`
2. Login with the admin credentials you set in `.env`
3. View dashboard, contacts, and newsletter subscribers

## Project Structure

```
Portfolio-Admin-Panel/
├── server/
│   ├── models/
│   │   ├── Contact.js
│   │   └── Newsletter.js
│   ├── routes/
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
├── src/
│   ├── pages/
│   │   └── admin/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Contacts.jsx
│   │       └── Newsletter.jsx
│   ├── components/
│   │   └── AdminLayout.jsx
│   ├── services/
│   │   └── api.js
│   ├── routes/
│   │   └── AdminRoutes.jsx
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

## API Endpoints

### Authentication

- `POST /api/admin/login` - Login with email and password

### Protected Routes (requires JWT)

- `GET /api/admin/stats` - Get total contacts and newsletters
- `GET /api/admin/contacts` - Get all contact messages (with search, sort, pagination)
- `GET /api/admin/contacts/:id` - Get single contact
- `POST /api/admin/contacts` - Create new contact
- `PUT /api/admin/contacts/:id` - Update contact
- `DELETE /api/admin/contacts/:id` - Delete contact
- `POST /api/admin/contacts/bulk-delete` - Delete multiple contacts
- `GET /api/admin/newsletters` - Get all newsletters (with search, sort, pagination)
- `GET /api/admin/newsletters/:id` - Get single newsletter
- `POST /api/admin/newsletters` - Create new newsletter subscription
- `PUT /api/admin/newsletters/:id` - Update newsletter
- `DELETE /api/admin/newsletters/:id` - Delete newsletter
- `POST /api/admin/newsletters/bulk-delete` - Delete multiple newsletters

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:

- **Backend**: Render
- **Frontend**: Vercel

### Quick Deploy

1. **Backend (Render)**:

   - Root Directory: `server`
   - Build: `npm install`
   - Start: `npm start`
   - Add environment variables from `server/.env.example`

2. **Frontend (Vercel)**:
   - Framework: Vite
   - Build: `npm run build`
   - Output: `dist`
   - Add: `VITE_API_URL=https://your-backend.onrender.com/api/admin`

## Notes

- Make sure MongoDB is running and accessible
- Keep your `.env` file secure and never commit it to git
- The admin credentials are configurable via environment variables
- Full CRUD operations available with search and sorting
- Production-ready with proper CORS and security headers
