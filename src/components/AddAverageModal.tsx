import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Gauge } from 'lucide-react';

interface AddAverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (average: number) => void;
  currentAverage: number;
  isLocked?: boolean;
}

const AddAverageModal: React.FC<AddAverageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentAverage,
  isLocked = false
}) => {
  const [average, setAverage] = useState(currentAverage.toString());

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const avgValue = parseFloat(average);
    if (avgValue > 0) {
      onSave(avgValue);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-full p-2 mr-3">
              <Gauge className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Set Diesel Average</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {isLocked && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                Average is locked for this month because diesel has already been added. You cannot change it.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="average" className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Average (km/l)
            </label>
            <input
              type="number"
              id="average"
              value={average}
              onChange={(e) => setAverage(e.target.value)}
              step="0.1"
              min="0.1"
              disabled={isLocked}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., 8.5"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              {isLocked
                ? 'Average cannot be changed after diesel has been added this month'
                : 'Enter your vehicle\'s fuel efficiency in kilometers per liter'}
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLocked}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Save Average
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AddAverageModal;
