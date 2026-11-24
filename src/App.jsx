import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import BusinessPage from './pages/admin/business/Registry';
import Security from './pages/admin/business/Security';
import System from './pages/admin/business/System';
import Chats from './pages/admin/Chats';
import Finance from './pages/admin/Finance';
import AdminRoutes from './routes/AdminRoutes';
import { AdminAuthProvider } from './context/AdminAuth';

function App() {
    return (
        <BrowserRouter>
          <AdminAuthProvider>
            <Routes>
                <Route path="/" element={<Navigate to="/admin" />} />
                <Route path="/admin/login" element={<Login />} />

                {/* Protected admin routes */}
                <Route element={<AdminRoutes />}>
                    <Route path="/admin" element={<Dashboard />} />
                    <Route path="/admin/contacts/:id?" element={<BusinessPage kind="contacts" />} />
                    <Route path="/admin/newsletter/:id?" element={<BusinessPage kind="newsletters" />} />
                    <Route path="/admin/users/:id?" element={<BusinessPage kind="users" />} />
                    <Route path="/admin/activity/:id?" element={<BusinessPage kind="activity" />} />
                    <Route path="/admin/blog-engagement/:id?" element={<BusinessPage kind="blog-posts" />} />
                    <Route path="/admin/blog-engagement/supports/:id?" element={<BusinessPage kind="blog-supports" />} />
                    <Route path="/admin/security" element={<Security />} />
                    <Route path="/admin/security/audit/:id?" element={<Security audit />} />
                    <Route path="/admin/system" element={<System />} />
                    <Route path="/admin/settings" element={<System settings />} />
                    <Route path="/admin/chats" element={<Chats />} />
                    <Route path="/admin/financial" element={<Finance />} />
                    <Route path="/admin/financial/:view" element={<Finance />} />
                    <Route path="/admin/financial/:view/:id" element={<Finance />} />
                    <Route path="/admin/bookings/:id?" element={<Finance fixedView="bookings" />} />
                    <Route path="/admin/support-payments/:id?" element={<Finance fixedView="support-payments" />} />
                    <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
                </Route>
            </Routes>
          </AdminAuthProvider>
        </BrowserRouter>
    );
}

export default App;
