import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label } from '../types';

interface ColorOption {
  name: string;
  value: string;
}

const colorOptions: ColorOption[] = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Fuchsia', value: '#D946EF' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Rose', value: '#F43F5E' },
];

interface AddLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingLabel: Label | null;
}

const AddLabelModal: React.FC<AddLabelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingLabel,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(colorOptions[0].value);
  const [isDriverStatus, setIsDriverStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (editingLabel) {
      setName(editingLabel.name);
      setColor(editingLabel.color);
      setIsDriverStatus(editingLabel.is_driver_status);
    } else {
      setName('');
      setColor(colorOptions[0].value);
      setIsDriverStatus(false);
    }
  }, [editingLabel, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to create a label');
      return;
    }

    if (!name.trim()) {
      toast.error('Please enter a label name');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingLabel) {
        // Update existing label
        const { error } = await supabase
          .from('labels')
          .update({ name, color, is_driver_status: isDriverStatus })
          .eq('id', editingLabel.id);

        if (error) throw error;
        toast.success('Label updated successfully');
      } else {
        // Create new label
        const { error } = await supabase
          .from('labels')
          .insert([{ 
            name, 
            color, 
            user_id: user.id,
            is_driver_status: isDriverStatus
          }]);

        if (error) throw error;
        toast.success('Label created successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exit if not open
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-md mx-auto">
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingLabel ? 'Edit Label' : 'Create New Label'}
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6">
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Label Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter label name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isDriverStatus}
                      onChange={(e) => setIsDriverStatus(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      This is a Driver Status Label
                    </span>
                  </label>
                  {isDriverStatus && (
                    <p className="mt-1 text-sm text-gray-500">
                      Driver status labels include additional fields for tracking attendance and metrics
                    </p>
                  )}
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Label Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {colorOptions.map((option) => (
                      <motion.button
                        key={option.value}
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setColor(option.value)}
                        className={`w-8 h-8 rounded-full focus:outline-none ring-offset-2 ${
                          color === option.value ? 'ring-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: option.value }}
                        title={option.name}
                        aria-label={`Select ${option.name} color`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="mt-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto sm:ml-3 flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        {editingLabel ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingLabel ? 'Update Label' : 'Create Label'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 sm:mt-0 w-full sm:w-auto flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddLabelModal;