import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Calendar, Tractor, IndianRupee, Loader2, MapPin, UserCheck, UserX, Fuel, Gauge, Hourglass } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parse } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Label, DailyEntries, MonthlyData, MonthlyFuelData } from '../types';
import { getOrCreateMonthlyFuelData } from '../lib/monthlyFuelUtils';

import html2pdf from 'html2pdf.js';
import signatureImg from '../assets/signature.png';

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
      // 1. Convert entries to an array and sort by day
      const allRows = Object.entries(monthlyData.dailyEntries).sort(
        ([dayA], [dayB]) => parseInt(dayA, 10) - parseInt(dayB, 10)
      );

      // 2. Chunk the data (16 rows for the first page to fit headers, 24 for the rest)
      const ROWS_PER_FIRST_PAGE = 15;
      const ROWS_PER_SUBSEQUENT_PAGE = 24;
      const pages = [];

      if (allRows.length > 0) {
        pages.push(allRows.slice(0, ROWS_PER_FIRST_PAGE));
        let remaining = allRows.slice(ROWS_PER_FIRST_PAGE);
        while (remaining.length > 0) {
          pages.push(remaining.slice(0, ROWS_PER_SUBSEQUENT_PAGE));
          remaining = remaining.slice(ROWS_PER_SUBSEQUENT_PAGE);
        }
      } else {
        pages.push([]); // Generate at least one empty page if no data
      }

      // 3. Define the Overview HTML block (Only shown on Page 1)
      let overviewHtml = '';
      if (label.is_driver_status) {
        overviewHtml = `
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr>
              <td style="width: 50%; padding: 0; border: none; vertical-align: top;">
                <p style="margin: 0 0 5px 0; font-size: 9.5pt; color: #4b5563;"><strong>Total Tankers:</strong> <span style="color: #111827;">${monthlyData.totalTankers}</span></p>
                <p style="margin: 0 0 5px 0; font-size: 9.5pt; color: #4b5563;"><strong>Total KM:</strong> <span style="color: #111827;">${(monthlyData.totalKm || 0).toFixed(2)}</span></p>
                <p style="margin: 0; font-size: 9.5pt; color: #4b5563;"><strong>Cash Taken:</strong> <span style="color: #111827;">₹${(monthlyData.totalCashTaken || 0).toFixed(2)}</span></p>
              </td>
              <td style="width: 50%; padding: 0; border: none; vertical-align: top;">
                <p style="margin: 0 0 5px 0; font-size: 9.5pt; color: #4b5563;"><strong>Diesel Added:</strong> <span style="color: #111827;">${(monthlyData.totalDieselAdded || 0).toFixed(2)} L</span></p>
                <p style="margin: 0; font-size: 9.5pt; color: #4b5563;"><strong>Attendance:</strong> <span style="color: #10b981; font-weight: bold;">${monthlyData.totalPresentCount} P</span>, <span style="color: #ef4444; font-weight: bold;">${monthlyData.totalAbsentCount} A</span>, <span style="color: #f59e0b; font-weight: bold;">${monthlyData.totalHalfDayCount} HD</span></p>
              </td>
            </tr>
          </table>
        `;
      } else {
        overviewHtml = `
          <div>
            <p style="margin: 0 0 5px 0; font-size: 10.5pt; color: #4b5563;"><strong>Total Tankers Delivered:</strong> <span style="color: #111827;">${monthlyData.totalTankers}</span></p>
            <p style="margin: 0; font-size: 10.5pt; color: #4b5563;"><strong>Total Cash Logged:</strong> <span style="color: #111827;">₹${monthlyData.totalCash.toFixed(2)}</span></p>
          </div>
        `;
      }

      // 4. Define the Table Headers (Repeated on every page)
      let tableHeaders = '';
      if (label.is_driver_status) {
        tableHeaders = `
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: left; width: 12%;">Date</th>
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: center; width: 14%;">Status</th>
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: center; width: 10%;">Tankers</th>
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: center; width: 12%;">KM</th>
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: right; width: 14%;">Cash Taken</th>
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: center; width: 12%;">Diesel (L)</th>
          <th style="padding: 10px 8px; border: 1px solid #2c3e50; text-align: left; width: 26%;">Notes</th>
        `;
      } else {
        tableHeaders = `
          <th style="padding: 10px 12px; border: 1px solid #2c3e50; text-align: left; width: 40%;">Date (${monthName} ${year})</th>
          <th style="padding: 10px 12px; border: 1px solid #2c3e50; text-align: center; width: 30%;">Tankers Delivered</th>
          <th style="padding: 10px 12px; border: 1px solid #2c3e50; text-align: right; width: 30%;">Cash Amount</th>
        `;
      }

      // 5. Build the Master HTML String Page by Page
      let htmlContent = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; background-color: #ffffff; width: 100%;">`;

      pages.forEach((pageRows, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;
        const pageBreakClass = isFirstPage ? '' : 'page-break'; // Triggers a clean cut before this div

        htmlContent += `
        <div class="${pageBreakClass}" style="padding: 15mm; box-sizing: border-box; position: relative;">
        `;

        if (isFirstPage) {
            htmlContent += `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 2px solid #2c3e50; padding-bottom: 15px; border: none;">
                <tr>
                    <td style="vertical-align: top; text-align: left; border: none; padding: 0;">
                        <h1 style="margin: 0; color: #2c3e50; font-size: 22pt; text-transform: uppercase; letter-spacing: 1px;">
                            ${label.is_driver_status ? 'Supply & Driver Record' : 'Supply Record'}
                        </h1>
                        <h2 style="margin: 8px 0 0 0; color: #34495e; font-size: 15pt;">Ganga Water Suppliers</h2>
                        <p style="margin: 4px 0 0 0; color: #7f8c8d; font-size: 11pt;">Proprietor: Gendalal Patidar</p>
                    </td>
                    <td style="vertical-align: bottom; text-align: right; border: none; padding: 0;">
                        <p style="margin: 0; font-size: 11pt; color: #34495e;"><strong>Date:</strong> ${format(new Date(), 'MMMM d, yyyy')}</p>
                        <p style="margin: 4px 0 0 0; font-size: 11pt; color: #7f8c8d;"><strong>Billing Period:</strong> ${monthName} ${year}</p>
                    </td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: none;">
                <tr>
                    <td style="width: 40%; padding: 0 10px 0 0; vertical-align: top; border: none;">
                        <div style="background-color: #f8f9fa; padding: 15px; border: 1px solid #e9ecef; border-radius: 6px; min-height: 100px;">
                            <h3 style="margin-top: 0; color: #2c3e50; font-size: 11pt; border-bottom: 1px solid #dee2e6; padding-bottom: 6px; margin-bottom: 10px;">
                                ${label.is_driver_status ? 'Driver Name' : 'Supplied To'}
                            </h3>
                            <p style="margin: 0; font-weight: bold; font-size: 11pt; color: #1f2937;">${label.name}</p>
                        </div>
                    </td>
                    <td style="width: 60%; padding: 0 0 0 10px; vertical-align: top; border: none;">
                        <div style="background-color: #f8f9fa; padding: 15px; border: 1px solid #e9ecef; border-radius: 6px; min-height: 100px;">
                            <h3 style="margin-top: 0; color: #2c3e50; font-size: 11pt; border-bottom: 1px solid #dee2e6; padding-bottom: 6px; margin-bottom: 10px;">Overview</h3>
                            ${overviewHtml}
                        </div>
                    </td>
                </tr>
            </table>
            `;
        }

        // Render Table and Headers for CURRENT page chunk
        htmlContent += `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #2c3e50; color: white;">
                    ${tableHeaders}
                </tr>
            </thead>
            <tbody>
        `;

        // Render Rows
        pageRows.forEach(([day, data], idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f9f9f9';
          const dayDate = format(parse(`${year}-${month}-${day}`, 'yyyy-MM-dd', new Date()), 'MMMM d');

          if (label.is_driver_status) {
            let statusBadge = '';
            if (data.presentCount > 0) {
              statusBadge = `<span style="background-color: #ecfdf5; color: #10b981; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 8.5pt;">Present</span>`;
            } else if (data.halfDayCount > 0) {
              statusBadge = `<span style="background-color: #fffbeb; color: #f59e0b; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 8.5pt;">Half Day</span>`;
            } else if (data.absentCount > 0) {
              statusBadge = `<span style="background-color: #fef2f2; color: #ef4444; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 8.5pt;">Absent</span>`;
            } else {
              statusBadge = `<span style="color: #4b5563;">-</span>`;
            }

            const notes = data.entries.map(e => e.notes).filter(Boolean).join(', ') || '-';

            htmlContent += `
              <tr style="background-color: ${bg}; font-size: 9.5pt;">
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; color: #4b5563;">${dayDate}</td>
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; text-align: center;">${statusBadge}</td>
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; text-align: center; color: #4b5563;">${data.totalTankers}</td>
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; text-align: center; color: #4b5563;">${(data.totalKm || 0).toFixed(2)}</td>
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; text-align: right; color: #4b5563;">${data.totalCashTaken > 0 ? `₹${data.totalCashTaken.toFixed(2)}` : '-'}</td>
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; text-align: center; color: #4b5563;">${data.totalDieselAdded > 0 ? data.totalDieselAdded.toFixed(2) : '-'}</td>
                <td style="padding: 10px 8px; border: 1px solid #dee2e6; font-size: 9pt; color: #6b7280;">${notes}</td>
              </tr>
            `;
          } else {
            htmlContent += `
              <tr style="background-color: ${bg}; font-size: 10.5pt;">
                <td style="padding: 10px 12px; border: 1px solid #dee2e6; color: #4b5563;">${dayDate}</td>
                <td style="padding: 10px 12px; border: 1px solid #dee2e6; text-align: center; color: #4b5563;">${data.totalTankers}</td>
                <td style="padding: 10px 12px; border: 1px solid #dee2e6; text-align: right; color: #4b5563;">₹${(data.totalCash || 0).toFixed(2)}</td>
              </tr>
            `;
          }
        });

        htmlContent += `</tbody></table>`;

        // Render Footer ONLY on the Last Page
        if (isLastPage) {
            htmlContent += `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 1px solid #bdc3c7; padding-top: 15px; border: none;">
                <tr>
                    <td style="width: 70%; vertical-align: middle; text-align: left; border: none; padding: 15px 0 0 0;">
                        <p style="font-weight: bold; font-size: 11pt; color: #2c3e50; margin: 0 0 5px 0;">
                            Thank you for choosing Ganga Water Suppliers.
                        </p>
                        <p style="font-size: 10pt; color: #7f8c8d; margin: 0;">
                            This document is computer-generated and serves as an official monthly supply${label.is_driver_status ? ' & driver ' : ' '}summary.
                        </p>
                    </td>
                    <td style="width: 30%; text-align: right; vertical-align: middle; border: none; padding: 15px 0 0 0;">
                        <img src="${signatureImg}" alt="Signature" style="height: 65px; margin: 0; display: inline-block;" />
                    </td>
                </tr>
            </table>
            `;
        }

        htmlContent += `</div>`; // Close Page Div
      });

      htmlContent += `</div>`; // Close Master Wrapper

      // 6. Generate PDF with pagebreak class logic
      const element = document.createElement('div');
      element.innerHTML = htmlContent;

      const opt = {
        margin:       0, // Zero margin, padding is handled strictly by the internal HTML divs
        filename:     `${label.name.replace(/\s+/g, '_')}_${monthName}_${year}_Summary.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css', before: '.page-break' } // Force perfect cuts
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('PDF report generated successfully');

    } catch (error: any) {
      toast.error('Failed to generate PDF: ' + error.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
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
