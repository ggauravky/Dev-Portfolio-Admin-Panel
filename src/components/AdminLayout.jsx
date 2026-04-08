/* eslint-disable react/prop-types */
import { Link, useNavigate, useLocation } from 'react-router-dom';

const AdminLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Navigation */}
            <nav className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center space-x-2">
                            {/* Logo */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg mr-4">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                            </div>

                            {/* Navigation Links */}
                            <Link
                                to="/admin"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Dashboard
                            </Link>
                            <Link
                                to="/admin/contacts"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin/contacts'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Contacts
                            </Link>
                            <Link
                                to="/admin/newsletter"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin/newsletter'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Newsletter
                            </Link>
                            <Link
                                to="/admin/chats"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin/chats'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
                                </svg>
                                Chats
                            </Link>
                            <Link
                                to="/admin/mllogs"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin/mllogs'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6m3 6V7m3 10v-4m3 8H6a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2z" />
                                </svg>
                                ML Logs
                            </Link>
                            <Link
                                to="/admin/bookings"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin/bookings'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m5 0a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2h18z" />
                                </svg>
                                Bookings
                            </Link>
                            <Link
                                to="/admin/support-payments"
                                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${location.pathname === '/admin/support-payments'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Support Payments
                            </Link>
                        </div>
                        <div className="flex items-center">
                            <button
                                onClick={handleLogout}
                                className="flex items-center px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
};

export default AdminLayout;
