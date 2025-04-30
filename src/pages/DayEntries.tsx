import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Clock, IndianRupee, Save, X, Loader2, Tractor, MapPin, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parse } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label, TankerEntry } from '../types';

interface TankerFormEntry {
  id?: string;
  time: string;
  cash_amount: string;
  total_tankers: string;
  driver_status?: 'present' | 'absent' | null;
  total_km?: string;
  cash_taken?: string;
  notes?: string;
  isNew?: boolean;
  isEditing?: boolean;
}

const DayEntries: React.FC = () => {
  const { labelId, year, month, day } = useParams<{ 
    labelId: string, year: string, month: string, day: string 
  }>();
  const [label, setLabel] = useState<Label | null>(null);
  const [entries, setEntries] = useState<TankerEntry[]>([]);
  const [formEntries, setFormEntries] = useState<TankerFormEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const dateString = `${year}-${month}-${day}`;
  const displayDate = format(parse(dateString, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy');

  useEffect(() => {
    if (user && labelId) {
      fetchLabel();
      fetchEntriesForDay();
    }
  }, [user, labelId, year, month, day]);

  const fetchLabel = async () => {
    try {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('id', labelId)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        throw error;
      }

      setLabel(data || null);
    } catch (error: any) {
      toast.error('Failed to load label: ' + error.message);
      navigate('/');
    }
  };

  const fetchEntriesForDay = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('tanker_entries')
        .select('*')
        .eq('label_id', labelId)
        .eq('user_id', user?.id)
        .eq('date', dateString)
        .order('time');

      if (error) {
        throw error;
      }

      setEntries(data || []);
      
      // Convert to form entries
      const formData = (data || []).map(entry => ({
        id: entry.id,
        time: entry.time,
        cash_amount: entry.cash_amount ? String(entry.cash_amount) : '',
        total_tankers: entry.total_tankers ? String(entry.total_tankers) : '',
        driver_status: entry.driver_status,
        total_km: entry.total_km ? String(entry.total_km) : '',
        cash_taken: entry.cash_taken ? String(entry.cash_taken) : '',
        notes: entry.notes || '',
        isEditing: false
      }));
      
      setFormEntries(formData);
    } catch (error: any) {
      toast.error('Failed to load entries: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addNewEntry = () => {
    setFormEntries(prev => [
      ...prev, 
      { 
        time: '09:00', 
        cash_amount: '', 
        total_tankers: '', 
        driver_status: label?.is_driver_status ? 'present' : null,
        total_km: '',
        cash_taken: '',
        notes: '',
        isNew: true, 
        isEditing: true 
      }
    ]);
  };

  const updateFormEntry = (
    index: number, 
    field: keyof TankerFormEntry, 
    value: string | 'present' | 'absent' | null
  ) => {
    const newFormEntries = [...formEntries];
    newFormEntries[index] = { ...newFormEntries[index], [field]: value };
    setFormEntries(newFormEntries);
  };

  const toggleEditMode = (index: number) => {
    const newFormEntries = [...formEntries];
    newFormEntries[index] = { 
      ...newFormEntries[index], 
      isEditing: !newFormEntries[index].isEditing 
    };
    setFormEntries(newFormEntries);
  };

  const deleteEntry = async (index: number) => {
    const entry = formEntries[index];
    
    if (entry.isNew) {
      setFormEntries(prev => prev.filter((_, i) => i !== index));
      return;
    }
    
    try {
      const { error } = await supabase
        .from('tanker_entries')
        .delete()
        .eq('id', entry.id);

      if (error) {
        throw error;
      }

      setFormEntries(prev => prev.filter((_, i) => i !== index));
      toast.success('Entry deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete entry: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!user || !labelId) return;
    
    setIsSaving(true);
    
    try {
      // Validate form entries
      for (let i = 0; i < formEntries.length; i++) {
        const entry = formEntries[i];
        if (!entry.time) {
          toast.error(`Entry #${i + 1} is missing a time.`);
          setIsSaving(false);
          return;
        }
        if (label?.is_driver_status && !entry.driver_status) {
          toast.error(`Entry #${i + 1} is missing a driver status.`);
          setIsSaving(false);
          return;
        }
      }
      
      // Process entries
      for (let i = 0; i < formEntries.length; i++) {
        const entry = formEntries[i];
        const cashAmount = entry.cash_amount ? parseFloat(entry.cash_amount) : null;
        const totalTankers = entry.total_tankers ? parseInt(entry.total_tankers) : null;
        const totalKm = entry.total_km ? parseFloat(entry.total_km) : null;
        const cashTaken = entry.cash_taken ? parseFloat(entry.cash_taken) : null;
        
        if (entry.isNew) {
          // Insert new entry
          const { error } = await supabase
            .from('tanker_entries')
            .insert({
              label_id: labelId,
              user_id: user.id,
              date: dateString,
              time: entry.time,
              cash_amount: cashAmount,
              total_tankers: totalTankers,
              driver_status: entry.driver_status,
              total_km: totalKm,
              cash_taken: cashTaken,
              notes: entry.notes || null
            });
            
          if (error) throw error;
        } else if (entry.isEditing) {
          // Update existing entry
          const { error } = await supabase
            .from('tanker_entries')
            .update({
              time: entry.time,
              cash_amount: cashAmount,
              total_tankers: totalTankers,
              driver_status: entry.driver_status,
              total_km: totalKm,
              cash_taken: cashTaken,
              notes: entry.notes || null
            })
            .eq('id', entry.id);
            
          if (error) throw error;
        }
      }
      
      toast.success('Entries saved successfully');
      await fetchEntriesForDay(); // Refresh data
    } catch (error: any) {
      toast.error('Failed to save entries: ' + error.message);
    } finally {
      setIsSaving(false);
    }
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

  if (isLoading && !label) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center mb-4 sm:mb-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/labels/${labelId}`)}
            className="p-2 mr-2 rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span 
                className="inline-block w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: label?.color || '#3B82F6' }}
              />
              {label?.name || 'Label'}: {displayDate}
            </h1>
            <p className="text-gray-600">
              Manage {label?.is_driver_status ? 'driver status' : 'tanker'} entries for this day
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            {label?.is_driver_status ? 'Driver Status Entries' : 'Tanker Entries'}
          </h2>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={addNewEntry}
            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </motion.button>
        </div>
        
        <AnimatePresence initial={false}>
          {formEntries.length === 0 && !isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <p className="text-gray-500">
                No entries for this day. Click "Add Entry" to create one.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-gray-200"
            >
              {formEntries.map((entry, index) => (
                <motion.div 
                  key={entry.id || `new-${index}`}
                  variants={itemVariants}
                  layout
                  className={`p-4 ${entry.isEditing ? 'bg-blue-50' : ''}`}
                >
                  {entry.isEditing ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Time
                          </label>
                          <input
                            type="time"
                            value={entry.time}
                            onChange={(e) => updateFormEntry(index, 'time', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>

                        {label?.is_driver_status ? (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Driver Status
                              </label>
                              <div className="flex gap-4">
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    value="present"
                                    checked={entry.driver_status === 'present'}
                                    onChange={() => updateFormEntry(index, 'driver_status', 'present')}
                                    className="form-radio h-4 w-4 text-blue-600"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Present</span>
                                </label>
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    value="absent"
                                    checked={entry.driver_status === 'absent'}
                                    onChange={() => updateFormEntry(index, 'driver_status', 'absent')}
                                    className="form-radio h-4 w-4 text-blue-600"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Absent</span>
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <MapPin className="h-4 w-4 inline mr-1" />
                                Total KM
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={entry.total_km}
                                onChange={(e) => updateFormEntry(index, 'total_km', e.target.value)}
                                placeholder="Enter total kilometers"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                              />
                            </div>
                          </>
                        ) : null}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Tractor className="h-4 w-4 inline mr-1" />
                            Total Tankers (Optional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={entry.total_tankers}
                            onChange={(e) => updateFormEntry(index, 'total_tankers', e.target.value)}
                            placeholder="Enter total tankers"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>

                        {label?.is_driver_status ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <IndianRupee className="h-4 w-4 inline mr-1" />
                              Cash Taken
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry.cash_taken}
                              onChange={(e) => updateFormEntry(index, 'cash_taken', e.target.value)}
                              placeholder="Enter cash taken"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <IndianRupee className="h-4 w-4 inline mr-1" />
                              Cash Amount (Optional)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry.cash_amount}
                              onChange={(e) => updateFormEntry(index, 'cash_amount', e.target.value)}
                              placeholder="Enter amount"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {label?.is_driver_status && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <FileText className="h-4 w-4 inline mr-1" />
                            Notes (Optional)
                          </label>
                          <textarea
                            value={entry.notes}
                            onChange={(e) => updateFormEntry(index, 'notes', e.target.value)}
                            placeholder="Add any additional notes..."
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        </div>
                      )}
                      
                      <div className="flex justify-end gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleEditMode(index)}
                          className="p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                          aria-label="Cancel"
                        >
                          <X className="h-5 w-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => deleteEntry(index)}
                          className="p-2 text-red-600 hover:text-red-800 focus:outline-none"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="font-medium">{entry.time}</span>
                        </div>
                        
                        {label?.is_driver_status && (
                          <div className="mt-1 flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              entry.driver_status === 'present' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {entry.driver_status === 'present' ? 'Present' : 'Absent'}
                            </span>
                          </div>
                        )}

                        {entry.total_tankers && (
                          <div className="mt-1 flex items-center text-gray-600">
                            <Tractor className="h-4 w-4 text-gray-500 mr-2" />
                            <span>{entry.total_tankers} tankers</span>
                          </div>
                        )}

                        {entry.cash_amount && !label?.is_driver_status && (
                          <div className="mt-1 flex items-center text-gray-600">
                            <IndianRupee className="h-4 w-4 text-gray-500 mr-2" />
                            <span>₹{parseFloat(entry.cash_amount).toFixed(2)}</span>
                          </div>
                        )}

                        {label?.is_driver_status && (
                          <>
                            {entry.total_km && (
                              <div className="mt-1 flex items-center text-gray-600">
                                <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                                <span>{entry.total_km} KM</span>
                              </div>
                            )}
                            
                            {entry.cash_taken && (
                              <div className="mt-1 flex items-center text-gray-600">
                                <IndianRupee className="h-4 w-4 text-gray-500 mr-2" />
                                <span>{parseFloat(entry.cash_taken).toFixed(2)} taken</span>
                              </div>
                            )}

                            {entry.notes && (
                              <div className="mt-1 flex items-center text-gray-600">
                                <FileText className="h-4 w-4 text-gray-500 mr-2" />
                                <span className="text-sm">{entry.notes}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => toggleEditMode(index)}
                          className="p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                          aria-label="Edit"
                        >
                          <Edit2 className="h-5 w-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteEntry(index)}
                          className="p-2 text-red-600 hover:text-red-800 focus:outline-none"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        {formEntries.length > 0 && (
          <div className="p-4 border-t border-gray-200 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save All Changes
                </>
              )}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayEntries;