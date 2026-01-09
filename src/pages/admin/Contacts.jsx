import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { getContacts, deleteContact, updateContact, bulkDeleteContacts, createContact } from '../../services/api';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedEmail, setCopiedEmail] = useState(null);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [editingContact, setEditingContact] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchContacts();
    }, [sortBy, sortOrder]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = contacts.filter(contact =>
                contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contact.message.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredContacts(filtered);
        } else {
            setFilteredContacts(contacts);
        }
    }, [searchTerm, contacts]);

    const fetchContacts = async () => {
        try {
            setError(null);
            const data = await getContacts({ sortBy, order: sortOrder });
            const contactsList = data.contacts || data;
            setContacts(contactsList);
            setFilteredContacts(contactsList);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            setError('Failed to load contacts. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;

        try {
            await deleteContact(id);
            setContacts(contacts.filter(c => c._id !== id));
            setError(null);
        } catch (error) {
            console.error('Error deleting contact:', error);
            setError('Failed to delete contact. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedContacts.length === 0) return;
        if (!window.confirm(`Delete ${selectedContacts.length} selected contact(s)?`)) return;

        try {
            await bulkDeleteContacts(selectedContacts);
            setContacts(contacts.filter(c => !selectedContacts.includes(c._id)));
            setSelectedContacts([]);
            setError(null);
        } catch (error) {
            console.error('Error bulk deleting:', error);
            setError('Failed to delete contacts. Please try again.');
        }
    };

    const handleUpdate = async (id, updatedData) => {
        try {
            await updateContact(id, updatedData);
            await fetchContacts();
            setEditingContact(null);
            setError(null);
        } catch (error) {
            console.error('Error updating contact:', error);
            setError('Failed to update contact. Please try again.');
        }
    };

    const handleCreate = async (newData) => {
        try {
            await createContact(newData);
            await fetchContacts();
            setShowAddModal(false);
            setError(null);
        } catch (error) {
            console.error('Error creating contact:', error);
            setError('Failed to create contact. Please try again.');
        }
    };

    const toggleSelectContact = (id) => {
        setSelectedContacts(prev =>
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedContacts.length === filteredContacts.length) {
            setSelectedContacts([]);
        } else {
            setSelectedContacts(filteredContacts.map(c => c._id));
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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
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
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            Contact Messages
                        </h1>
                        <p className="text-gray-600 mt-2">Manage and respond to customer inquiries</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center space-x-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Contact</span>
                    </button>
                </div>

                {/* Toolbar */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="flex-1 min-w-[300px] relative">
                            <input
                                type="text"
                                placeholder="Search by name, email, or message..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
                                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="createdAt">Date</option>
                                <option value="name">Name</option>
                                <option value="email">Email</option>
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
                        {selectedContacts.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center space-x-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete ({selectedContacts.length})</span>
                            </button>
                        )}

                        {/* Refresh */}
                        <button
                            onClick={fetchContacts}
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

                {filteredContacts.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                        <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-lg">No contact messages found.</p>
                    </div>
                ) : (
                    <>
                        {/* Select All */}
                        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                />
                                <span className="text-gray-700 font-medium">
                                    {selectedContacts.length === filteredContacts.length && filteredContacts.length > 0 ? 'Deselect All' : 'Select All'}
                                    ({filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'})
                                </span>
                            </label>
                        </div>

                        {/* Contacts List */}
                        <div className="space-y-4">
                            {filteredContacts.map((contact) => (
                                <ContactCard
                                    key={contact._id}
                                    contact={contact}
                                    isSelected={selectedContacts.includes(contact._id)}
                                    isEditing={editingContact?._id === contact._id}
                                    onToggleSelect={toggleSelectContact}
                                    onDelete={handleDelete}
                                    onEdit={setEditingContact}
                                    onUpdate={handleUpdate}
                                    onCancelEdit={() => setEditingContact(null)}
                                    copiedEmail={copiedEmail}
                                    onCopyEmail={copyToClipboard}
                                    formatDate={formatDate}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Add Contact Modal */}
            {showAddModal && (
                <AddContactModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleCreate}
                />
            )}
        </AdminLayout>
    );
};

// Contact Card Component
const ContactCard = ({ contact, isSelected, isEditing, onToggleSelect, onDelete, onEdit, onUpdate, onCancelEdit, copiedEmail, onCopyEmail, formatDate }) => {
    const [formData, setFormData] = useState({
        name: contact.name,
        email: contact.email,
        message: contact.message
    });

    if (isEditing) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-500">
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Name"
                    />
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Email"
                    />
                    <textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                        placeholder="Message"
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={() => onUpdate(contact._id, formData)}
                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Save Changes
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
        <div className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 ${isSelected ? 'ring-2 ring-purple-500' : ''}`}>
            <div className="flex items-start gap-4">
                {/* Checkbox */}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(contact._id)}
                    className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />

                {/* Avatar */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {contact.name.charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{contact.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={() => onCopyEmail(contact.email)}
                                    className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-sm"
                                >
                                    {contact.email}
                                    {copiedEmail === contact.email ? (
                                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(contact.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{contact.message}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onEdit(contact)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(contact._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

// Add Contact Modal Component
const AddContactModal = ({ onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Add New Contact
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter email"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                        <textarea
                            required
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[120px]"
                            placeholder="Enter message"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                        >
                            Add Contact
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

export default Contacts;
