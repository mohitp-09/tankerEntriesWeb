import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, AlertCircle, Search, Pin, PinOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label } from '../types';
import AddLabelModal from '../components/AddLabelModal';

const Dashboard: React.FC = () => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [filteredLabels, setFilteredLabels] = useState<Label[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchLabels();
    }
  }, [user]);

  useEffect(() => {
    // Filter and sort labels based on search query and pin status
    const filtered = labels
      .filter(label => label.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        // Sort by pin status first (pinned labels on top)
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        // Then sort by name
        return a.name.localeCompare(b.name);
      });
    setFilteredLabels(filtered);
  }, [searchQuery, labels]);

  const fetchLabels = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_pinned', { ascending: false })
        .order('name');

      if (error) {
        throw error;
      }

      setLabels(data || []);
      setFilteredLabels(data || []);
    } catch (error: any) {
      toast.error('Failed to load labels: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePin = async (label: Label) => {
    try {
      const { error } = await supabase
        .from('labels')
        .update({ is_pinned: !label.is_pinned })
        .eq('id', label.id);

      if (error) {
        throw error;
      }

      setLabels(current =>
        current.map(l =>
          l.id === label.id ? { ...l, is_pinned: !l.is_pinned } : l
        )
      );

      toast.success(label.is_pinned ? 'Label unpinned' : 'Label pinned');
    } catch (error: any) {
      toast.error('Failed to update label: ' + error.message);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      // First confirm with the user
      if (!window.confirm('Are you sure you want to delete this label? All associated tanker entries will also be deleted.')) {
        return;
      }

      // Delete the label (cascade delete should handle tanker entries)
      const { error } = await supabase
        .from('labels')
        .delete()
        .eq('id', labelId);

      if (error) {
        throw error;
      }

      setLabels((current) => current.filter((label) => label.id !== labelId));
      toast.success('Label deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete label: ' + error.message);
    }
  };

  const handleEditLabel = (label: Label) => {
    setEditingLabel(label);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLabel(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Loading labels...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Labels</h1>
        <p className="text-gray-600 mt-1">
          Select a label to view and manage tanker entries
        </p>
      </div>

      {labels.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No labels found</h3>
          <p className="text-gray-600 mb-4">
            Create your first label to start tracking tanker entries
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
            Create a Label
          </motion.button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filteredLabels.map((label) => (
                <motion.div
                  key={label.id}
                  variants={itemVariants}
                  layout
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <div
                    className="h-2"
                    style={{ backgroundColor: label.color }}
                    aria-hidden="true"
                  />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate" title={label.name}>
                          {label.name}
                        </h3>
                        {label.is_pinned && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Pinned
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => togglePin(label)}
                          className={`p-1 rounded-full ${
                            label.is_pinned
                              ? 'text-blue-600 hover:text-blue-800'
                              : 'text-gray-400 hover:text-gray-600'
                          } focus:outline-none`}
                          aria-label={label.is_pinned ? 'Unpin label' : 'Pin label'}
                        >
                          {label.is_pinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEditLabel(label)}
                          className="p-1 rounded-full text-gray-400 hover:text-gray-600 focus:outline-none"
                          aria-label={`Edit ${label.name}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteLabel(label.id)}
                          className="p-1 rounded-full text-gray-400 hover:text-red-600 focus:outline-none"
                          aria-label={`Delete ${label.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02, backgroundColor: '#F9FAFB' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/labels/${label.id}`)}
                      className="mt-4 w-full py-2 px-3 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      View Tanker Entries
                    </motion.button>
                  </div>
                </motion.div>
              ))}

              {/* Add Label Card */}
              <motion.div
                variants={itemVariants}
                className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-6 text-center h-[156px]"
              >
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsModalOpen(true)}
                  className="p-2 rounded-full bg-blue-100 text-blue-600 mb-3"
                  aria-label="Add new label"
                >
                  <Plus className="h-6 w-6" />
                </motion.button>
                <p className="text-sm font-medium text-gray-900">Add Custom Label</p>
                <p className="text-xs text-gray-500 mt-1">Create a new tracking category</p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <AddLabelModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={fetchLabels}
        editingLabel={editingLabel}
      />
    </>
  );
};

export default Dashboard;
