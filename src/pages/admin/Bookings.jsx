import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { getBookings, deleteBooking, bulkDeleteBookings } from '../../services/api';

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBookings, setSelectedBookings] = useState([]);
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchBookings();
    }, [sortBy, sortOrder]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = bookings.filter(booking =>
                (booking.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (booking.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (booking.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (booking.service || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (booking.paymentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (booking.orderId || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredBookings(filtered);
        } else {
            setFilteredBookings(bookings);
        }
    }, [searchTerm, bookings]);

    const fetchBookings = async () => {
        try {
            setError(null);
            const data = await getBookings({
                sortBy,
                order: sortOrder,
            });
            const bookingsList = data.bookings || data;
            setBookings(bookingsList);
            setFilteredBookings(bookingsList);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            setError('Failed to load bookings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this booking?')) return;

        try {
            await deleteBooking(id);
            setBookings(bookings.filter(b => b._id !== id));
            setError(null);
        } catch (error) {
            console.error('Error deleting booking:', error);
            setError('Failed to delete booking. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedBookings.length === 0) return;
        if (!window.confirm(`Delete ${selectedBookings.length} selected booking(s)?`)) return;

        try {
            await bulkDeleteBookings(selectedBookings);
            setBookings(bookings.filter(b => !selectedBookings.includes(b._id)));
            setSelectedBookings([]);
            setError(null);
        } catch (error) {
            console.error('Error bulk deleting:', error);
            setError('Failed to delete bookings. Please try again.');
        }
    };

    const toggleSelectBooking = (id) => {
        setSelectedBookings(prev =>
            prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedBookings.length === filteredBookings.length) {
            setSelectedBookings([]);
        } else {
            setSelectedBookings(filteredBookings.map(b => b._id));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        return timeString;
    };

    const formatCurrency = (amount) => {
        if (!amount) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-600"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            Service Bookings
                        </h1>
                        <p className="text-gray-600 mt-2">Manage and track all service bookings and payments</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="flex-1 min-w-[300px] relative">
                            <input
                                type="text"
                                placeholder="Search by name, email, phone, service, payment ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Sort Controls */}
                        <div className="flex gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="createdAt">Date Created</option>
                                <option value="date">Date Booked</option>
                                <option value="name">Name</option>
                                <option value="email">Email</option>
                                <option value="service">Service</option>
                                <option value="amount">Amount</option>
                                <option value="preferredDate">Preferred Date</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <svg className={`w-5 h-5 transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>

                        {/* Bulk Actions */}
                        {selectedBookings.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center space-x-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete ({selectedBookings.length})</span>
                            </button>
                        )}

                        {/* Refresh */}
                        <button
                            onClick={fetchBookings}
                            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl mb-6 flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {filteredBookings.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-lg">No bookings found.</p>
                    </div>
                ) : (
                    <>
                        {/* Select All */}
                        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedBookings.length === filteredBookings.length && filteredBookings.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                                />
                                <span className="text-gray-700 font-medium">
                                    {selectedBookings.length === filteredBookings.length && filteredBookings.length > 0 ? 'Deselect All' : 'Select All'}
                                    ({filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'})
                                </span>
                            </label>
                        </div>

                        {/* Bookings List */}
                        <div className="space-y-4">
                            {filteredBookings.map((booking) => (
                                <BookingCard
                                    key={booking._id}
                                    booking={booking}
                                    isSelected={selectedBookings.includes(booking._id)}
                                    onToggleSelect={toggleSelectBooking}
                                    onDelete={handleDelete}
                                    formatDate={formatDate}
                                    formatTime={formatTime}
                                    formatCurrency={formatCurrency}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

// Booking Card Component
const BookingCard = ({ booking, isSelected, onToggleSelect, onDelete, formatDate, formatTime, formatCurrency }) => {
    return (
        <div className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}>
            <div className="flex items-start gap-4">
                {/* Checkbox */}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(booking._id)}
                    className="mt-1 w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                />

                {/* Avatar */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0">
                    {(booking.name || '?').charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                <h3 className="text-lg font-bold text-gray-900">{booking.name || 'Unknown'}</h3>
                                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                                    {booking.service || 'Service'}
                                </span>
                            </div>
                            
                            {/* Contact Info */}
                            <div className="space-y-1 text-sm mb-3">
                                <p>
                                    <span className="text-gray-600">Email:</span>
                                    <span className="text-emerald-600 font-medium ml-2">{booking.email || 'N/A'}</span>
                                </p>
                                <p>
                                    <span className="text-gray-600">Phone:</span>
                                    <span className="text-emerald-600 font-medium ml-2">{booking.phone || 'N/A'}</span>
                                </p>
                            </div>

                            {/* Booking Details */}
                            <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">Preferred Date</span>
                                        <p className="font-semibold text-gray-900">{formatDate(booking.preferredDate)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Preferred Time</span>
                                        <p className="font-semibold text-gray-900">{formatTime(booking.preferredTime)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Amount</span>
                                        <p className="font-semibold text-emerald-600">{formatCurrency(booking.amount)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Payment ID</span>
                                        <p className="font-semibold text-gray-900 truncate">{booking.paymentId || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Project Brief */}
                            {booking.projectBrief && (
                                <div className="mb-3">
                                    <p className="text-xs text-gray-600 mb-1">Project Brief:</p>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded line-clamp-2">{booking.projectBrief}</p>
                                </div>
                            )}

                            {/* Footer Info */}
                            <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                                <span>Order ID: {booking.orderId || 'unknown'}</span>
                                <span>Booked on: {formatDate(booking.createdAt || booking.date)}</span>
                            </div>
                        </div>

                        {/* Timestamp */}
                        <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(booking.createdAt)}</span>
                    </div>
                </div>

                {/* Action */}
                <div>
                    <button
                        onClick={() => onDelete(booking._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Delete"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Bookings;
