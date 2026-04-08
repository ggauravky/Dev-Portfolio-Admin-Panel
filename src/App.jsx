import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Contacts from './pages/admin/Contacts';
import Newsletter from './pages/admin/Newsletter';
import Chats from './pages/admin/Chats';
import MlLogs from './pages/admin/MlLogs';
import Bookings from './pages/admin/Bookings';
import SupportPayments from './pages/admin/SupportPayments';
import AdminRoutes from './routes/AdminRoutes';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/admin" />} />
                <Route path="/admin/login" element={<Login />} />

                {/* Protected admin routes */}
                <Route element={<AdminRoutes />}>
                    <Route path="/admin" element={<Dashboard />} />
                    <Route path="/admin/contacts" element={<Contacts />} />
                    <Route path="/admin/newsletter" element={<Newsletter />} />
                    <Route path="/admin/chats" element={<Chats />} />
                    <Route path="/admin/mllogs" element={<MlLogs />} />
                    <Route path="/admin/bookings" element={<Bookings />} />
                    <Route path="/admin/support-payments" element={<SupportPayments />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
