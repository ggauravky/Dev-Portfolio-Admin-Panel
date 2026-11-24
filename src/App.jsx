import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Contacts from './pages/admin/Contacts';
import Newsletter from './pages/admin/Newsletter';
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
                    <Route path="/admin/contacts" element={<Contacts />} />
                    <Route path="/admin/newsletter" element={<Newsletter />} />
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
