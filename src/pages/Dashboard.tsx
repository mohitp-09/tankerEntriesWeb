import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label } from '../types';
import AddLabelModal from '../components/AddLabelModal';

const Dashboard: React.FC = () => {
  const [labels, setLabels] = useState<Label[]>([]);
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

  const fetchLabels = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) {
        throw error;
      }

      setLabels(data || []);
    } catch (error: any) {
      toast.error('Failed to load labels: ' + error.message);
    } finally {
      setIsLoading(false);
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
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {labels.map((label) => (
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
                    <h3 className="text-lg font-medium text-gray-900 truncate" title={label.name}>
                      {label.name}
                    </h3>
                    <div className="flex space-x-2">
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