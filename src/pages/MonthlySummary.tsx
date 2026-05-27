import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Calendar, Tractor, IndianRupee, Loader2, MapPin, UserCheck, UserX, Fuel, Gauge, Hourglass } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parse } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label, TankerEntry, DailyEntries, MonthlyData, MonthlyFuelData } from '../types';
import { getOrCreateMonthlyFuelData } from '../lib/monthlyFuelUtils';

const calculateHalfDayConversion = (halfDayCount: number) => {
  const convertedPresent = Math.floor(halfDayCount / 2);
  const remainingHalfDays = halfDayCount % 2;
  return { convertedPresent, remainingHalfDays };
};

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
    totalAbsentCount: 0,
    totalHalfDayCount: 0,
    totalDieselAdded: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [monthlyFuelData, setMonthlyFuelData] = useState<MonthlyFuelData | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const monthName = year && month ? format(parse(`${year}-${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM') : '';

  useEffect(() => {
    if (user && labelId && year && month) {
      const loadData = async () => {
        await fetchLabel();
        await fetchMonthlyFuelData();
        await fetchMonthData();
      };
      loadData();
    }
  }, [user, labelId, year, month]);

  const fetchMonthlyFuelData = async () => {
    if (!user || !labelId || !year || !month) return;

    try {
      const data = await getOrCreateMonthlyFuelData(labelId, user.id, parseInt(month), parseInt(year));
      setMonthlyFuelData(data);
    } catch (error: any) {
      console.error('Failed to load monthly fuel data:', error.message);
    }
  };

  const fetchLabel = async () => {
    try {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('id', labelId)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        toast.error('Label not found');
        navigate('/');
        return;
      }

      setLabel(data);
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
      let totalHalfDayCount = 0;
      let totalDieselAdded = 0;

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
            absentCount: 0,
            halfDayCount: 0,
            totalDieselAdded: 0
          };
        }

        dailyEntries[day].entries.push(entry);

        const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);
        dailyEntries[day].totalTankers += tankerCount;
        totalTankers += tankerCount;

        dailyEntries[day].totalCash += entry.cash_amount || 0;
        dailyEntries[day].totalKm += entry.total_km || 0;
        dailyEntries[day].totalCashTaken += entry.cash_taken || 0;
        dailyEntries[day].totalDieselAdded += entry.diesel_added || 0;

        if (entry.driver_status === 'present') {
          dailyEntries[day].presentCount++;
          totalPresentCount++;
        } else if (entry.driver_status === 'absent') {
          dailyEntries[day].absentCount++;
          totalAbsentCount++;
        } else if (entry.driver_status === 'half_day') {
          dailyEntries[day].halfDayCount++;
          totalHalfDayCount++;
        }

        totalCash += entry.cash_amount || 0;
        totalKm += entry.total_km || 0;
        totalCashTaken += entry.cash_taken || 0;
        totalDieselAdded += entry.diesel_added || 0;
      });

      const sortedDailyEntries = Object.entries(dailyEntries)
        .sort(([dayA], [dayB]) => parseInt(dayA, 10) - parseInt(dayB, 10))
        .reduce((acc, [day, data]) => ({ ...acc, [day]: data }), {} as Record<string, DailyEntries>);

      setMonthlyData({
        dailyEntries: sortedDailyEntries,
        totalTankers,
        totalCash,
        totalKm,
        totalCashTaken,
        totalPresentCount,
        totalAbsentCount,
        totalHalfDayCount,
        totalDieselAdded
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
        doc.text(`Total Diesel Added: ${monthlyData.totalDieselAdded.toFixed(2)} L`, 14, yPosition);
        yPosition += 7;
        doc.text(`Vehicle Average (This Month): ${monthlyFuelData?.diesel_average || 0} km/l`, 14, yPosition);
        yPosition += 7;
        doc.text(`Current Range: ${monthlyFuelData?.current_range?.toFixed(2) || '0.00'} km`, 14, yPosition);
        yPosition += 7;
        if (monthlyFuelData && monthlyFuelData.carried_range > 0) {
          doc.text(`Carried Range: ${monthlyFuelData.carried_range.toFixed(2)} km`, 14, yPosition);
          yPosition += 7;
        }
        doc.text(`Present Days: ${monthlyData.totalPresentCount}`, 14, yPosition);
        yPosition += 7;
        doc.text(`Absent Days: ${monthlyData.totalAbsentCount}`, 14, yPosition);
        yPosition += 7;
        const halfDayConversion = calculateHalfDayConversion(monthlyData.totalHalfDayCount);
        doc.text(`Half Days: ${monthlyData.totalHalfDayCount}`, 14, yPosition);
        yPosition += 7;
        if (monthlyData.totalHalfDayCount > 0) {
          doc.text(`Half Days Converted: ${halfDayConversion.convertedPresent} day${halfDayConversion.convertedPresent !== 1 ? 's' : ''} (${halfDayConversion.remainingHalfDays} remaining)`, 14, yPosition);
          yPosition += 7;
        }
      } else {
        doc.text(`Total Cash: ₹${monthlyData.totalCash.toFixed(2)}`, 14, yPosition);
        yPosition += 7;
      }

      doc.setFontSize(10);
      doc.text(`Generated on: ${format(new Date(), 'MMMM d, yyyy, h:mm a')}`, 14, yPosition);

      doc.line(14, yPosition + 5, 196, yPosition + 5);

      yPosition += 10;

      Object.entries(monthlyData.dailyEntries)
        .sort(([dayA], [dayB]) => parseInt(dayA, 10) - parseInt(dayB, 10))
        .forEach(([day, data]) => {
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
          ? ['#', 'Time', 'Status', 'Tankers', 'KM', 'Cash', 'Diesel (L)', 'Notes']
          : ['#', 'Time', 'Tankers', 'Cash Amount'];

        const tableData = data.entries.map((entry, index) => {
          const tankerCount = entry.total_tankers ?? (entry.driver_status === 'absent' ? 0 : 1);
          const statusDisplay = entry.driver_status === 'half_day' ? 'Half Day' : entry.driver_status || '-';

          if (label.is_driver_status) {
            return [
              (index + 1).toString(),
              entry.time,
              statusDisplay,
              tankerCount.toString(),
              entry.total_km?.toFixed(2) || '-',
              entry.cash_taken ? `₹${entry.cash_taken.toFixed(2)}` : '-',
              entry.diesel_added > 0 ? entry.diesel_added.toFixed(2) : '-',
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
                    {(monthlyData.totalKm || 0).toFixed(2)}
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
                    ₹{(monthlyData.totalCashTaken || 0).toFixed(2)}
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

              <div className="bg-orange-50 rounded-lg p-4 flex items-center">
                <div className="bg-orange-100 rounded-full p-3 mr-4">
                  <Hourglass className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-800">Total Half Days</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {monthlyData.totalHalfDayCount}
                  </p>
                  {monthlyData.totalHalfDayCount > 0 && (
                    <p className="text-xs text-orange-700 mt-1">
                      {calculateHalfDayConversion(monthlyData.totalHalfDayCount).convertedPresent} day{calculateHalfDayConversion(monthlyData.totalHalfDayCount).convertedPresent !== 1 ? 's' : ''} converted
                      {calculateHalfDayConversion(monthlyData.totalHalfDayCount).remainingHalfDays > 0 && ` + ${calculateHalfDayConversion(monthlyData.totalHalfDayCount).remainingHalfDays} remaining`}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 flex items-center">
                <div className="bg-amber-100 rounded-full p-3 mr-4">
                  <Fuel className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">Total Diesel Added</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {(monthlyData.totalDieselAdded || 0).toFixed(2)} L
                  </p>
                </div>
              </div>

              <div className="bg-cyan-50 rounded-lg p-4 flex items-center">
                <div className="bg-cyan-100 rounded-full p-3 mr-4">
                  <Gauge className="h-6 w-6 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-cyan-800">Average (This Month)</p>
                  <p className="text-2xl font-bold text-cyan-900">
                    {monthlyFuelData?.diesel_average || 0} km/l
                  </p>
                </div>
              </div>

              <div className="bg-teal-50 rounded-lg p-4 flex items-center">
                <div className="bg-teal-100 rounded-full p-3 mr-4">
                  <Fuel className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-teal-800">Current Range</p>
                  <p className="text-2xl font-bold text-teal-900">
                    {monthlyFuelData?.current_range?.toFixed(2) || '0.00'} km
                  </p>
                </div>
              </div>

              {monthlyFuelData && monthlyFuelData.carried_range > 0 && (
                <div className="bg-sky-50 rounded-lg p-4 flex items-center">
                  <div className="bg-sky-100 rounded-full p-3 mr-4">
                    <Fuel className="h-6 w-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-sky-800">Carried Range</p>
                    <p className="text-2xl font-bold text-sky-900">
                      {monthlyFuelData.carried_range.toFixed(2)} km
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-green-50 rounded-lg p-4 flex items-center">
              <div className="bg-green-100 rounded-full p-3 mr-4">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Total Cash</p>
                <p className="text-2xl font-bold text-green-900">
                  ₹{(monthlyData.totalCash || 0).toFixed(2)}
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
          <div className="overflow-x-auto">
            <motion.table
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="min-w-full divide-y divide-gray-200"
            >
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  {label?.is_driver_status && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tankers
                  </th>
                  {label?.is_driver_status ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        KM
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cash Taken
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Diesel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </>
                  ) : (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cash Amount
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(monthlyData.dailyEntries).sort(([dayA], [dayB]) => parseInt(dayA, 10) - parseInt(dayB, 10)).map(([day, data]) => {
                  const dayDate = format(parse(`${year}-${month}-${day}`, 'yyyy-MM-dd', new Date()), 'd MMMM, yyyy');
                  const statusType = data.presentCount > 0 ? 'present' : data.halfDayCount > 0 ? 'half_day' : data.absentCount > 0 ? 'absent' : null;

                  return (
                    <motion.tr
                      key={day}
                      variants={itemVariants}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {dayDate}
                      </td>
                      {label?.is_driver_status && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {statusType ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              statusType === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : statusType === 'half_day'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {statusType === 'present' ? (
                                <>
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Present
                                </>
                              ) : statusType === 'half_day' ? (
                                <>
                                  <Hourglass className="h-3 w-3 mr-1" />
                                  Half Day
                                </>
                              ) : (
                                <>
                                  <UserX className="h-3 w-3 mr-1" />
                                  Absent
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {data.totalTankers}
                      </td>
                      {label?.is_driver_status ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {(data.totalKm || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            ₹{(data.totalCashTaken || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {data.totalDieselAdded > 0 ? `${(data.totalDieselAdded || 0).toFixed(2)} L` : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                            {data.entries.map(e => e.notes).filter(Boolean).join(', ') || '-'}
                          </td>
                        </>
                      ) : (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ₹{(data.totalCash || 0).toFixed(2)}
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </motion.table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlySummary;
