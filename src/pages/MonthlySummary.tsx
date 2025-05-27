import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Calendar, Tractor, IndianRupee, Loader2, MapPin, UserCheck, UserX } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parse } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label, TankerEntry, DailyEntries, MonthlyData } from '../types';

const MonthlySummary: React.FC = () => {
  const { labelId, year, month } = useParams<{
    labelId: string, year: string, month: string
  }>();
  const [label, setLabel] = useState<Label | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    dailyEntries: {},
    totalTankers: 0,
    totalCash: 0,
    totalKm: 0,
    totalCashTaken: 0,
    totalPresentCount: 0,
    totalAbsentCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const monthName = format(parse(`${year}-${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM');

  useEffect(() => {
    if (user && labelId) {
      fetchLabel();
      fetchMonthData();
    }
  }, [user, labelId, year, month]);

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

  const fetchMonthData = async () => {
    try {
      setIsLoading(true);

      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;

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

      const dailyEntries: Record<string, DailyEntries> = {};
      let totalTankers = 0;
      let totalCash = 0;
      let totalKm = 0;
      let totalCashTaken = 0;
      let totalPresentCount = 0;
      let totalAbsentCount = 0;

      (data || []).forEach(entry => {
        const day = entry.date.split('-')[2];

        if (!dailyEntries[day]) {
          dailyEntries[day] = {
            day: parseInt(day),
            entries: [],
            totalTankers: 0,
            totalCash: 0,
            totalKm: 0,
            totalCashTaken: 0,
            presentCount: 0,
            absentCount: 0
          };
        }

        dailyEntries[day].entries.push(entry);

        // Count tankers based on the entered value, defaulting to 0 for absent drivers
        const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);
        dailyEntries[day].totalTankers += tankerCount;
        totalTankers += tankerCount;

        dailyEntries[day].totalCash += entry.cash_amount || 0;
        dailyEntries[day].totalKm += entry.total_km || 0;
        dailyEntries[day].totalCashTaken += entry.cash_taken || 0;

        if (entry.driver_status === 'present') {
          dailyEntries[day].presentCount++;
          totalPresentCount++;
        } else if (entry.driver_status === 'absent') {
          dailyEntries[day].absentCount++;
          totalAbsentCount++;
        }

        totalCash += entry.cash_amount || 0;
        totalKm += entry.total_km || 0;
        totalCashTaken += entry.cash_taken || 0;
      });

      const sortedDailyEntries = Object.entries(dailyEntries)
        .sort(([dayA], [dayB]) => parseInt(dayA) - parseInt(dayB))
        .reduce((acc, [day, data]) => ({ ...acc, [day]: data }), {});

      setMonthlyData({
        dailyEntries: sortedDailyEntries,
        totalTankers,
        totalCash,
        totalKm,
        totalCashTaken,
        totalPresentCount,
        totalAbsentCount
      });
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePdf = async () => {
    if (!label) return;

    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF();
      const title = `${label.name} - ${monthName} ${year} Summary`;

      doc.setFontSize(16);
      doc.text(title, 105, 15, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Total Tankers: ${monthlyData.totalTankers}`, 14, 25);

      let yPosition = 32;

      if (label.is_driver_status) {
        doc.text(`Total KM: ${monthlyData.totalKm.toFixed(2)}`, 14, yPosition);
        yPosition += 7;
        doc.text(`Total Cash Taken: ₹${monthlyData.totalCashTaken.toFixed(2)}`, 14, yPosition);
        yPosition += 7;
        doc.text(`Present Days: ${monthlyData.totalPresentCount}`, 14, yPosition);
        yPosition += 7;
        doc.text(`Absent Days: ${monthlyData.totalAbsentCount}`, 14, yPosition);
        yPosition += 7;
      } else {
        doc.text(`Total Cash: ₹${monthlyData.totalCash.toFixed(2)}`, 14, yPosition);
        yPosition += 7;
      }

      doc.setFontSize(10);
      doc.text(`Generated on: ${format(new Date(), 'MMMM d, yyyy, h:mm a')}`, 14, yPosition);

      doc.line(14, yPosition + 5, 196, yPosition + 5);

      yPosition += 10;

      Object.entries(monthlyData.dailyEntries).forEach(([day, data]) => {
        const dayDate = format(parse(`${year}-${month}-${day}`, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy');

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');

        let dayHeader = `${dayDate} - ${data.totalTankers} Tankers`;
        if (label.is_driver_status) {
          dayHeader += ` - ${data.totalKm} KM - ₹${data.totalCashTaken.toFixed(2)} taken`;
          if (data.presentCount > 0) dayHeader += ' - Present';
          if (data.absentCount > 0) dayHeader += ' - Absent';
        } else {
          dayHeader += ` - ₹${data.totalCash.toFixed(2)}`;
        }

        doc.text(dayHeader, 14, yPosition);

        yPosition += 8;

        const tableHeaders = label.is_driver_status
          ? ['#', 'Time', 'Status', 'Tankers', 'KM', 'Cash Taken', 'Notes']
          : ['#', 'Time', 'Tankers', 'Cash Amount'];

        const tableData = data.entries.map((entry, index) => {
          const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);

          if (label.is_driver_status) {
            return [
              (index + 1).toString(),
              entry.time,
              entry.driver_status || '-',
              tankerCount.toString(),
              entry.total_km?.toFixed(2) || '-',
              entry.cash_taken ? `₹${entry.cash_taken.toFixed(2)}` : '-',
              entry.notes || '-'
            ];
          }
          return [
            (index + 1).toString(),
            entry.time,
            tankerCount.toString(),
            entry.cash_amount ? `₹${entry.cash_amount.toFixed(2)}` : '-'
          ];
        });

        // @ts-ignore (jspdf-autotable types)
        doc.autoTable({
          startY: yPosition,
          head: [tableHeaders],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          margin: { left: 14, right: 14 },
          styles: { fontSize: 10 }
        });

        // @ts-ignore (accessing internal value)
        yPosition = doc.lastAutoTable.finalY + 10;

        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
      });

      doc.save(`${label.name.replace(/\s+/g, '_')}_${monthName}_${year}_Summary.pdf`);
      toast.success('PDF report generated successfully');
    } catch (error: any) {
      toast.error('Failed to generate PDF: ' + error.message);
    } finally {
      setIsGeneratingPdf(false);
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
              {label?.name || 'Label'}: Monthly Summary
            </h1>
            <p className="text-gray-600">
              {monthName} {year} summary of {label?.is_driver_status ? 'driver status' : 'tanker'} entries
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={generatePdf}
          disabled={isGeneratingPdf || isLoading}
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download as PDF
            </>
          )}
        </motion.button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <FileText className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900">Monthly Overview</h2>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 flex items-center">
            <div className="bg-blue-100 rounded-full p-3 mr-4">
              <Tractor className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Total Tankers</p>
              <p className="text-2xl font-bold text-blue-900">{monthlyData.totalTankers}</p>
            </div>
          </div>

          {label?.is_driver_status ? (
            <>
              <div className="bg-green-50 rounded-lg p-4 flex items-center">
                <div className="bg-green-100 rounded-full p-3 mr-4">
                  <MapPin className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Total KM</p>
                  <p className="text-2xl font-bold text-green-900">
                    {monthlyData.totalKm.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 flex items-center">
                <div className="bg-purple-100 rounded-full p-3 mr-4">
                  <IndianRupee className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-800">Total Cash Taken</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {monthlyData.totalCashTaken.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-lg p-4 flex items-center">
                <div className="bg-emerald-100 rounded-full p-3 mr-4">
                  <UserCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-800">Total Present Days</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {monthlyData.totalPresentCount}
                  </p>
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-4 flex items-center">
                <div className="bg-red-100 rounded-full p-3 mr-4">
                  <UserX className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">Total Absent Days</p>
                  <p className="text-2xl font-bold text-red-900">
                    {monthlyData.totalAbsentCount}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-green-50 rounded-lg p-4 flex items-center">
              <div className="bg-green-100 rounded-full p-3 mr-4">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Total Cash</p>
                <p className="text-2xl font-bold text-green-900">
                  ₹{monthlyData.totalCash.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <Calendar className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-medium text-gray-900">Daily Breakdown</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading monthly data...</p>
          </div>
        ) : Object.keys(monthlyData.dailyEntries).length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No entries found for this month.</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-gray-200"
          >
            {Object.entries(monthlyData.dailyEntries).map(([day, data]) => {
              const dayDate = format(parse(`${year}-${month}-${day}`, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy');

              return (
                <motion.div
                  key={day}
                  variants={itemVariants}
                  className="p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                    <h3 className="text-md font-medium text-gray-900">
                      {dayDate}
                    </h3>
                    <div className="mt-2 sm:mt-0 flex flex-wrap gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Tractor className="h-3 w-3 mr-1" />
                        {data.totalTankers} Tankers
                      </span>

                      {label?.is_driver_status ? (
                        <>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <MapPin className="h-3 w-3 mr-1" />
                            {data.totalKm.toFixed(2)} KM
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <IndianRupee className="h-3 w-3 mr-1" />
                            ₹{data.totalCashTaken.toFixed(2)}
                          </span>
                          {data.presentCount > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Present
                            </span>
                          )}
                          {data.absentCount > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <UserX className="h-3 w-3 mr-1" />
                              Absent
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <IndianRupee className="h-3 w-3 mr-1" />
                          ₹{data.totalCash.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                          {label?.is_driver_status && (
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          )}
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tankers
                          </th>
                          {label?.is_driver_status ? (
                            <>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                KM
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Cash Taken
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Notes
                              </th>
                            </>
                          ) : (
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Cash Amount
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.entries.map((entry, index) => {
                          const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);

                          return (
                            <tr key={entry.id}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                {index + 1}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                {entry.time}
                              </td>
                              {label?.is_driver_status && (
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    entry.driver_status === 'present'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {entry.driver_status === 'present' ? 'Present' : 'Absent'}
                                  </span>
                                </td>
                              )}
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                {tankerCount}
                              </td>
                              {label?.is_driver_status ? (
                                <>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                    {entry.total_km?.toFixed(2) || '-'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                    {entry.cash_taken ? `₹${entry.cash_taken.toFixed(2)}` : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                                    {entry.notes || '-'}
                                  </td>
                                </>
                              ) : (
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                  {entry.cash_amount ? `₹${entry.cash_amount.toFixed(2)}` : '-'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MonthlySummary;
