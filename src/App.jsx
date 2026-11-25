import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import Login from './pages/admin/Login';
import AdminRoutes from './routes/AdminRoutes';
import { AdminAuthProvider } from './context/AdminAuth';

const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const BusinessPage = lazy(() => import('./pages/admin/business/Registry'));
const Security = lazy(() => import('./pages/admin/business/Security'));
const System = lazy(() => import('./pages/admin/business/System'));
const Chats = lazy(() => import('./pages/admin/Chats'));
const Finance = lazy(() => import('./pages/admin/Finance'));

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
