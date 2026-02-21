import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { getNewsletters, deleteNewsletter, updateNewsletter, bulkDeleteNewsletters, createNewsletter } from '../../services/api';

const Newsletter = () => {
    const [newsletters, setNewsletters] = useState([]);
    const [filteredNewsletters, setFilteredNewsletters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedEmail, setCopiedEmail] = useState(null);
    const [selectedNewsletters, setSelectedNewsletters] = useState([]);
    const [editingNewsletter, setEditingNewsletter] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortBy, setSortBy] = useState('subscribedAt');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchNewsletters();
    }, [sortBy, sortOrder]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = newsletters.filter(newsletter =>
                newsletter.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredNewsletters(filtered);
        } else {
            setFilteredNewsletters(newsletters);
        }
    }, [searchTerm, newsletters]);

    const fetchNewsletters = async () => {
        try {
            setError(null);
            const data = await getNewsletters({ sortBy, order: sortOrder });
            const newslettersList = data.newsletters || data;
            setNewsletters(newslettersList);
            setFilteredNewsletters(newslettersList);
        } catch (error) {
            console.error('Error fetching newsletters:', error);
            setError('Failed to load newsletters. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this newsletter subscription?')) return;

        try {
            await deleteNewsletter(id);
            setNewsletters(newsletters.filter(n => n._id !== id));
            setError(null);
        } catch (error) {
            console.error('Error deleting newsletter:', error);
            setError('Failed to delete newsletter subscription. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedNewsletters.length === 0) return;
        if (!window.confirm(`Delete ${selectedNewsletters.length} selected subscription(s)?`)) return;

        try {
            await bulkDeleteNewsletters(selectedNewsletters);
            setNewsletters(newsletters.filter(n => !selectedNewsletters.includes(n._id)));
            setSelectedNewsletters([]);
            setError(null);
        } catch (error) {
            console.error('Error bulk deleting:', error);
            setError('Failed to delete newsletter subscriptions. Please try again.');
        }
    };

    const handleUpdate = async (id, updatedData) => {
        try {
            await updateNewsletter(id, updatedData);
            await fetchNewsletters();
            setEditingNewsletter(null);
            setError(null);
        } catch (error) {
            console.error('Error updating newsletter:', error);
            setError('Failed to update newsletter subscription. Please try again.');
        }
    };

    const handleCreate = async (email) => {
        try {
            await createNewsletter(email);
            await fetchNewsletters();
            setShowAddModal(false);
            setError(null);
        } catch (error) {
            console.error('Error creating newsletter:', error);
            setError(error.message || 'Failed to create newsletter subscription. Please try again.');
        }
    };

    const toggleSelectNewsletter = (id) => {
        setSelectedNewsletters(prev =>
            prev.includes(id) ? prev.filter(nId => nId !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedNewsletters.length === filteredNewsletters.length) {
            setSelectedNewsletters([]);
        } else {
            setSelectedNewsletters(filteredNewsletters.map(n => n._id));
        }
    };

    const copyToClipboard = async (email) => {
        try {
            await navigator.clipboard.writeText(email);
            setCopiedEmail(email);
            setTimeout(() => setCopiedEmail(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const exportEmails = () => {
        const emails = filteredNewsletters.map(n => n.email).join(', ');
        copyToClipboard(emails);
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

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-600"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            Newsletter Subscribers
                        </h1>
                        <p className="text-gray-600 mt-2">Manage your newsletter subscriber list</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center space-x-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Subscriber</span>
                    </button>
                </div>

                {/* Toolbar */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="flex-1 min-w-[300px] relative">
                            <input
                                type="text"
                                placeholder="Search by email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
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
                                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="subscribedAt">Subscribed Date</option>
                                <option value="createdAt">Created Date</option>
                                <option value="email">Email</option>
                                <option value="subscribed">Status</option>
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

                        {/* Export All */}
                        <button
                            onClick={exportEmails}
                            className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center space-x-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy All</span>
                        </button>

                        {/* Bulk Actions */}
                        {selectedNewsletters.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center space-x-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete ({selectedNewsletters.length})</span>
                            </button>
                        )}

                        {/* Refresh */}
                        <button
                            onClick={fetchNewsletters}
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

                {filteredNewsletters.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-lg">No newsletter subscribers found.</p>
                    </div>
                ) : (
                    <>
                        {/* Select All */}
                        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedNewsletters.length === filteredNewsletters.length && filteredNewsletters.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                                />
                                <span className="text-gray-700 font-medium">
                                    {selectedNewsletters.length === filteredNewsletters.length && filteredNewsletters.length > 0 ? 'Deselect All' : 'Select All'}
                                    ({filteredNewsletters.length} {filteredNewsletters.length === 1 ? 'subscriber' : 'subscribers'})
                                </span>
                            </label>
                        </div>

                        {/* Newsletter Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredNewsletters.map((subscriber) => (
                                <NewsletterCard
                                    key={subscriber._id}
                                    subscriber={subscriber}
                                    isSelected={selectedNewsletters.includes(subscriber._id)}
                                    isEditing={editingNewsletter?._id === subscriber._id}
                                    onToggleSelect={toggleSelectNewsletter}
                                    onDelete={handleDelete}
                                    onEdit={setEditingNewsletter}
                                    onUpdate={handleUpdate}
                                    onCancelEdit={() => setEditingNewsletter(null)}
                                    copiedEmail={copiedEmail}
                                    onCopyEmail={copyToClipboard}
                                    formatDate={formatDate}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Add Subscriber Modal */}
            {showAddModal && (
                <AddSubscriberModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleCreate}
                />
            )}
        </AdminLayout>
    );
};

// Newsletter Card Component
const NewsletterCard = ({ subscriber, isSelected, isEditing, onToggleSelect, onDelete, onEdit, onUpdate, onCancelEdit, copiedEmail, onCopyEmail, formatDate }) => {
    const [formData, setFormData] = useState({
        email: subscriber.email || '',
        subscribed: subscriber.subscribed !== false
    });
    const isSubscribed = subscriber.subscribed !== false;
    const statusLabel = isSubscribed ? 'Subscribed' : 'Unsubscribed';
    const statusClasses = isSubscribed
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-gray-100 text-gray-700';

    if (isEditing) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-500">
                <div className="space-y-4">
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="Email"
                    />
                    <select
                        value={formData.subscribed ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, subscribed: e.target.value === 'true' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="true">Subscribed</option>
                        <option value="false">Unsubscribed</option>
                    </select>
                    <div className="flex gap-3">
                        <button
                            onClick={() =>
                                onUpdate(subscriber._id, {
                                    email: formData.email,
                                    subscribed: formData.subscribed
                                })
                            }
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Save
                        </button>
                        <button
                            onClick={onCancelEdit}
                            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 ${isSelected ? 'ring-2 ring-green-500' : ''}`}>
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(subscriber._id)}
                    className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full w-10 h-10 flex items-center justify-center text-white shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                            </svg>
                        </div>
                        <button
                            onClick={() => onCopyEmail(subscriber.email)}
                            className="text-sm font-semibold text-green-600 hover:text-green-800 truncate flex items-center gap-1"
                            title={subscriber.email}
                        >
                            {subscriber.email || 'No email'}
                            {copiedEmail === subscriber.email ? (
                                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            )}
                        </button>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusClasses}`}>
                            {statusLabel}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {formatDate(subscriber.subscribedAt || subscriber.createdAt)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 truncate">
                        {subscriber.userAgent || 'unknown'}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                    <button
                        onClick={() => onEdit(subscriber)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(subscriber._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

// Add Subscriber Modal Component
const AddSubscriberModal = ({ onClose, onSubmit }) => {
    const [email, setEmail] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(email);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        Add New Subscriber
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            placeholder="Enter email address"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                        >
                            Add Subscriber
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Newsletter;
