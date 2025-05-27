import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, BarChart2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, getDaysInMonth, getMonth, getYear, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label, TankerEntry } from '../types';

const LabelView: React.FC = () => {
  const { labelId } = useParams<{ labelId: string }>();
  const [label, setLabel] = useState<Label | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<TankerEntry[]>([]);
  const [entriesByDay, setEntriesByDay] = useState<Record<string, TankerEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [totalTankers, setTotalTankers] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  const monthYear = format(currentDate, 'MMMM yyyy');
  const month = getMonth(currentDate) + 1;
  const year = getYear(currentDate);
  const daysInMonth = getDaysInMonth(currentDate);

  useEffect(() => {
    if (user && labelId) {
      fetchLabel();
      fetchEntriesForMonth();
    }
  }, [user, labelId, month, year]);

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

  const fetchEntriesForMonth = async () => {
    try {
      setIsLoading(true);

      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('tanker_entries')
        .select('*')
        .eq('label_id', labelId)
        .eq('user_id', user?.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) {
        throw error;
      }

      setEntries(data || []);

      const groupedEntries: Record<string, TankerEntry[]> = {};
      let monthlyTotalTankers = 0;

      (data || []).forEach(entry => {
        const day = entry.date.split('-')[2];
        if (!groupedEntries[day]) {
          groupedEntries[day] = [];
        }
        groupedEntries[day].push(entry);

        // Count tankers based on the entered value, defaulting to 0 for absent drivers
        const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);
        monthlyTotalTankers += tankerCount;
      });

      setEntriesByDay(groupedEntries);
      setTotalTankers(monthlyTotalTankers);
    } catch (error: any) {
      toast.error('Failed to load entries: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const handleDayClick = (day: number) => {
    const paddedDay = String(day).padStart(2, '0');
    const paddedMonth = String(month).padStart(2, '0');
    navigate(`/labels/${labelId}/${year}/${paddedMonth}/${paddedDay}`);
  };

  const getDayTotalTankers = (entries: TankerEntry[]) => {
    return entries.reduce((total, entry) => {
      // Count tankers based on the entered value, defaulting to 0 for absent drivers
      const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);
      return total + tankerCount;
    }, 0);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 }
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
            onClick={() => navigate('/')}
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
              {label?.name || 'Label'}
            </h1>
            <p className="text-gray-600">
              Manage tanker entries for this label
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(`/labels/${labelId}/${year}/${String(month).padStart(2, '0')}/summary`)}
          className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <BarChart2 className="mr-2 h-4 w-4 text-gray-500" />
          View Monthly Summary
        </motion.button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">{monthYear}</h2>
          </div>

          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigateToMonth(-1)}
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigateToMonth(1)}
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-600">Total Tankers:</span>
              <span className="ml-2 text-lg font-semibold text-blue-600">{totalTankers}</span>
            </div>

            {isLoading && (
              <div className="flex items-center text-sm text-gray-600">
                <Loader2 className="animate-spin h-4 w-4 mr-1" />
                Loading...
              </div>
            )}
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-7 gap-2"
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-1"
              >
                {day}
              </div>
            ))}

            {Array.from({ length: new Date(year, month-1, 1).getDay() }).map((_, i) => (
              <div key={`empty-start-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const paddedDay = String(day).padStart(2, '0');
              const hasEntries = !!entriesByDay[paddedDay];
              const dayEntries = entriesByDay[paddedDay] || [];
              const dayTotalTankers = hasEntries ? getDayTotalTankers(dayEntries) : 0;
              const isCurrentDay = isToday(new Date(year, month - 1, day));

              return (
                <motion.button
                  key={day}
                  variants={itemVariants}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDayClick(day)}
                  className={`py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 relative ${
                    isCurrentDay
                      ? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_2px_rgba(16,185,129,0.1)]'
                      : hasEntries
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'hover:bg-gray-50 border-gray-200 text-gray-800'
                  }`}
                >
                  <span className={`block text-sm font-medium ${
                    isCurrentDay ? 'text-emerald-700' : ''
                  }`}>{day}</span>
                  {hasEntries && (
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                      <span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative block rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                  )}
                  {dayTotalTankers > 0 && (
                    <span className="text-xs mt-1 block">
                      {dayTotalTankers} {dayTotalTankers === 1 ? 'tanker' : 'tankers'}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LabelView;
