import { supabase } from './supabase';
import { MonthlyFuelData } from '../types';

export const getOrCreateMonthlyFuelData = async (
  labelId: string,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyFuelData | null> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('monthly_fuel_data')
      .select('*')
      .eq('label_id', labelId)
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      return existing;
    }

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const { data: previousMonthData } = await supabase
      .from('monthly_fuel_data')
      .select('current_range')
      .eq('label_id', labelId)
      .eq('user_id', userId)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .maybeSingle();

    const carriedRange = previousMonthData?.current_range || 0;

    const { data: newRecord, error: insertError } = await supabase
      .from('monthly_fuel_data')
      .insert({
        label_id: labelId,
        user_id: userId,
        month,
        year,
        diesel_average: 0,
        total_diesel_added: 0,
        total_km_driven: 0,
        carried_range: carriedRange,
        current_range: carriedRange,
        is_average_locked: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return newRecord;
  } catch (error) {
    console.error('Error in getOrCreateMonthlyFuelData:', error);
    return null;
  }
};

export const updateMonthlyFuelAverage = async (
  monthlyFuelId: string,
  average: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('monthly_fuel_data')
      .select('is_average_locked, total_diesel_added')
      .eq('id', monthlyFuelId)
      .single();

    if (fetchError) throw fetchError;

    if (existing.is_average_locked && existing.total_diesel_added > 0) {
      return {
        success: false,
        error: 'Cannot change average after diesel has been added this month'
      };
    }

    const { error: updateError } = await supabase
      .from('monthly_fuel_data')
      .update({ diesel_average: average })
      .eq('id', monthlyFuelId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const recalculateMonthlyRange = async (
  labelId: string,
  userId: string,
  month: number,
  year: number
): Promise<void> => {
  try {
    const monthlyData = await getOrCreateMonthlyFuelData(labelId, userId, month, year);
    if (!monthlyData) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: entries, error } = await supabase
      .from('tanker_entries')
      .select('diesel_added, total_km')
      .eq('label_id', labelId)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    let totalDieselAdded = 0;
    let totalKmDriven = 0;

    (entries || []).forEach(entry => {
      totalDieselAdded += entry.diesel_added || 0;
      totalKmDriven += entry.total_km || 0;
    });

    const rangeFromDiesel = totalDieselAdded * monthlyData.diesel_average;
    const currentRange = Math.max(0, monthlyData.carried_range + rangeFromDiesel - totalKmDriven);

    const isLocked = totalDieselAdded > 0 && monthlyData.diesel_average > 0;

    const { error: updateError } = await supabase
      .from('monthly_fuel_data')
      .update({
        total_diesel_added: totalDieselAdded,
        total_km_driven: totalKmDriven,
        current_range: currentRange,
        is_average_locked: isLocked
      })
      .eq('id', monthlyData.id);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error recalculating monthly range:', error);
  }
};

export const getPreviousMonthData = async (
  labelId: string,
  userId: string,
  currentMonth: number,
  currentYear: number
): Promise<MonthlyFuelData | null> => {
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  try {
    const { data, error } = await supabase
      .from('monthly_fuel_data')
      .select('*')
      .eq('label_id', labelId)
      .eq('user_id', userId)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching previous month data:', error);
    return null;
  }
};
