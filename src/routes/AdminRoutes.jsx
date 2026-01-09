import { Navigate, Outlet } from 'react-router-dom';

const AdminRoutes = () => {
    const token = localStorage.getItem('adminToken');

    // If no token, redirect to login
    if (!token) {
        return <Navigate to="/admin/login" />;
    }

    return <Outlet />;
};

export default AdminRoutes;
