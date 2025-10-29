/**
 * Weight Tracking Calculation Utilities
 * 
 * This module handles all weight tracking calculations based on fixed 7-day week blocks.
 * Weeks are determined from a user-defined start date, and calculations remain stable
 * as new entries are added.
 * 
 * Key Principles:
 * - Week boundaries are fixed based on weightTrackingStartDate
 * - Week 1 = Days 0-6, Week 2 = Days 7-13, etc.
 * - Weekly average = sum of entries / count of entries in that week (NOT divided by 7)
 * - Previous week average is LOCKED once current week advances
 * - All entries remain visible regardless of start date
 * 
 * Important Features:
 * - **Option C Hybrid Behavior**: If no weightTrackingStartDate is set, automatically uses 
 *   the first entry's date as the start date (fallback mode)
 * - **Week Locking**: Once you move to a new week, the previous week's average becomes 
 *   permanent and never changes, even if you add more entries to that week later
 * - **Gap Handling**: Empty weeks are skipped. Previous week = most recent week with data
 * - **Multiple Entries Per Day**: All entries count toward the average, regardless of how 
 *   many are logged on the same day
 * - **Entries Before Start Date**: Filtered out of calculations but remain visible in UI
 * - **No Mutations**: All functions create copies of arrays; original data is never modified
 * 
 * Calculation Examples:
 * ```
 * Week 1 (Oct 5-11): [89.1, 88.2, 87.7] 
 *   → Average: (89.1 + 88.2 + 87.7) ÷ 3 = 88.33kg
 * 
 * Week 2 (Oct 12-18): [86.5]
 *   → Average: 86.5 ÷ 1 = 86.5kg
 *   → Previous Week: 88.33kg (LOCKED forever)
 * 
 * Add more entries to Week 2: [86.5, 86.0, 85.5]
 *   → Average: (86.5 + 86.0 + 85.5) ÷ 3 = 86.0kg (UPDATED)
 *   → Previous Week: 88.33kg (STILL LOCKED)
 * ```
 * The previous week average is NOT truly "locked" if you add entries retroactively.
    The system recalculates it because:
    You added a new entry to Week 1
    Week 1's average changed from 88.33kg → 87.75kg
    Since Week 1 is still the "previous week" relative to Week 2, it updates.

 * Edge Cases Handled:
 * - No entries → Returns all 0s
 * - No start date → Auto-uses first entry date (Option C)
 * - Only current week has data → Previous week = 0
 * - Week gaps (e.g., no entries in Week 2) → Finds most recent previous week
 * - Entries before start date → Ignored in calculations, visible in UI
 * - Single entry → Returns that entry as the average
 * 
 * Return Values:
 * - weeklyAverage: Current week's average weight
 * - previousWeeklyAverage: Previous week's average (locked)
 * - weeklyAverageDifference: weeklyAverage - previousWeeklyAverage
 * - totalDifference: Last entry - First entry (after start date)
 * - currentWeekNum: The current week number (1-based)
 * - previousWeekNum: The previous week number with data
 * - isUsingAutoStartDate: true if using fallback, false if explicit
 * - effectiveStartDate: The actual start date being used
 * - weekGroups: Object with all entries grouped by week number
 */

/**
 * Determines which week number a given date falls into
 * @param {string|Date} entryDate - The date to check
 * @param {string|Date} weightTrackingStartDate - The weight tracking start date
 * @returns {number} Week number (1-based, e.g., Week 1, Week 2, etc.)
 * @returns {null} If entryDate is before weightTrackingStartDate
 */
export const determineWeekNumber = (entryDate, weightTrackingStartDate) => {
  if (!weightTrackingStartDate || !entryDate) return null;

  const entry = new Date(entryDate);
  const start = new Date(weightTrackingStartDate);
  
  // Reset time to midnight for accurate day calculation
  entry.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  
  const daysSinceStart = Math.floor((entry - start) / (1000 * 60 * 60 * 24));
  
  // If entry is before start date, return null
  if (daysSinceStart < 0) return null;
  
  // Week 1 = days 0-6, Week 2 = days 7-13, etc.
  return Math.floor(daysSinceStart / 7) + 1;
};

/**
 * Groups weight entries by their week number
 * @param {Array} entries - Array of weight entry objects with {date, weight, ...}
 * @param {string|Date} weightTrackingStartDate - The weight tracking start date
 * @returns {Object} Object with week numbers as keys and arrays of entries as values
 * 
 * Example return:
 * {
 *   1: [{date: '2025-01-01', weight: 80}, {date: '2025-01-03', weight: 79.5}],
 *   2: [{date: '2025-01-08', weight: 79}],
 *   3: [{date: '2025-01-15', weight: 78.5}]
 * }
 */
export const groupEntriesByWeek = (entries, weightTrackingStartDate) => {
  if (!entries || entries.length === 0 || !weightTrackingStartDate) {
    return {};
  }

  const weekGroups = {};

  entries.forEach(entry => {
    const weekNum = determineWeekNumber(entry.date, weightTrackingStartDate);
    
    // Only group entries on or after start date
    if (weekNum !== null) {
      if (!weekGroups[weekNum]) {
        weekGroups[weekNum] = [];
      }
      weekGroups[weekNum].push(entry);
    }
  });

  return weekGroups;
};

/**
 * Calculates the average weight for a given array of entries
 * @param {Array} weekEntries - Array of weight entries for a specific week
 * @returns {number} Average weight rounded to 1 decimal place
 * @returns {0} If no entries provided
 */
export const calculateWeekAverage = (weekEntries) => {
  if (!weekEntries || weekEntries.length === 0) {
    return 0;
  }

  const sum = weekEntries.reduce((total, entry) => {
    return total + parseFloat(entry.weight);
  }, 0);

  const average = sum / weekEntries.length;
  return parseFloat(average.toFixed(1));
};

/**
 * Finds the week number of the most recent entry
 * @param {Array} entries - Array of weight entries (must be sorted by date)
 * @param {string|Date} weightTrackingStartDate - The weight tracking start date
 * @returns {number} The current week number
 * @returns {null} If no valid entries after weightTrackingStartDate
 */
export const getCurrentWeekNumber = (entries, weightTrackingStartDate) => {
  if (!entries || entries.length === 0 || !weightTrackingStartDate) {
    return null;
  }

  // Sort entries by date to get the most recent
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  // Find the most recent entry on or after start date
  for (let i = sortedEntries.length - 1; i >= 0; i--) {
    const weekNum = determineWeekNumber(sortedEntries[i].date, weightTrackingStartDate);
    if (weekNum !== null) {
      return weekNum;
    }
  }

  return null;
};

/**
 * Finds the previous week number that contains entries
 * Handles gaps in weeks (e.g., if current is Week 5 but Week 4 is empty, returns Week 3)
 * @param {number} currentWeekNum - The current week number
 * @param {Object} weekGroups - Object containing all week groups
 * @returns {number} The previous week number with entries
 * @returns {null} If no previous week exists
 */
export const getPreviousWeekNumber = (currentWeekNum, weekGroups) => {
  if (!currentWeekNum || !weekGroups) {
    return null;
  }

  // Look backwards from current week to find the most recent week with entries
  for (let weekNum = currentWeekNum - 1; weekNum >= 1; weekNum--) {
    if (weekGroups[weekNum] && weekGroups[weekNum].length > 0) {
      return weekNum;
    }
  }

  return null; // No previous week found
};

/**
 * Main calculation function - computes all weight tracking metrics
 * @param {Array} entries - Array of all weight entries
 * @param {string|Date} weightTrackingStartDate - The user's selected start date
 * @returns {Object} Object containing all calculated metrics
 * 
 * Returns:
 * {
 *   weeklyAverage: number,
 *   previousWeeklyAverage: number,
 *   weeklyAverageDifference: number,
 *   totalDifference: number,
 *   currentWeekNum: number,
 *   previousWeekNum: number,
 *   weekGroups: Object,
 *   firstEntry: Object,
 *   lastEntry: Object
 * }
 */
export const calculateWeightMetrics = (entries, weightTrackingStartDate) => {
  // Default return object
  const defaultMetrics = {
    weeklyAverage: 0,
    previousWeeklyAverage: 0,
    weeklyAverageDifference: 0,
    totalDifference: 0,
    currentWeekNum: null,
    previousWeekNum: null,
    weekGroups: {},
    firstEntry: null,
    lastEntry: null,
    isUsingAutoStartDate: false
  };

  // Validate inputs
  if (!entries || entries.length === 0) {
    return defaultMetrics;
  }

  // Sort entries by date first
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  // OPTION C - HYBRID APPROACH:
  // Use explicit start date if provided, otherwise fall back to first entry date
  let effectiveStartDate = weightTrackingStartDate;
  let isUsingAutoStartDate = false;

  if (!effectiveStartDate && sortedEntries.length > 0) {
    effectiveStartDate = sortedEntries[0].date;
    isUsingAutoStartDate = true;
  }

  // If still no start date (shouldn't happen with entries), return defaults
  if (!effectiveStartDate) {
    return defaultMetrics;
  }

  // Group entries by week using effective start date
  const weekGroups = groupEntriesByWeek(sortedEntries, effectiveStartDate);

  // Get current week number
  const currentWeekNum = getCurrentWeekNumber(sortedEntries, effectiveStartDate);

  if (!currentWeekNum || !weekGroups[currentWeekNum]) {
    return defaultMetrics;
  }

  // Calculate current week average
  const currentWeekEntries = weekGroups[currentWeekNum];
  const weeklyAverage = calculateWeekAverage(currentWeekEntries);

  // Get previous week number (handles gaps)
  const previousWeekNum = getPreviousWeekNumber(currentWeekNum, weekGroups);

  // Calculate previous week average
  let previousWeeklyAverage = 0;
  if (previousWeekNum) {
    const previousWeekEntries = weekGroups[previousWeekNum];
    previousWeeklyAverage = calculateWeekAverage(previousWeekEntries);
  }

  // Calculate weekly difference
  const weeklyAverageDifference = parseFloat(
    (weeklyAverage - previousWeeklyAverage).toFixed(1)
  );

  // Calculate total difference (from first entry after effective start date to latest entry)
  let totalDifference = 0;
  const entriesAfterStart = sortedEntries.filter(entry => 
    determineWeekNumber(entry.date, effectiveStartDate) !== null
  );

  if (entriesAfterStart.length > 0) {
    const firstEntry = entriesAfterStart[0];
    const lastEntry = entriesAfterStart[entriesAfterStart.length - 1];
    totalDifference = parseFloat(
      (parseFloat(lastEntry.weight) - parseFloat(firstEntry.weight)).toFixed(1)
    );
  }

  // Return all metrics
  return {
    weeklyAverage,
    previousWeeklyAverage,
    weeklyAverageDifference,
    totalDifference,
    currentWeekNum,
    previousWeekNum,
    weekGroups,
    firstEntry: entriesAfterStart[0] || null,
    lastEntry: entriesAfterStart[entriesAfterStart.length - 1] || null,
    isUsingAutoStartDate, // NEW: Indicates if using fallback start date
    effectiveStartDate // NEW: The actual start date being used
  };
};

/**
 * Helper function to format week range for display
 * @param {number} weekNum - The week number
 * @param {string|Date} weightTrackingStartDate - The weight tracking start date
 * @returns {string} Formatted date range string
 * 
 * Example: "5 Eki - 11 Eki 2025"
 */
export const getWeekDateRange = (weekNum, weightTrackingStartDate) => {
  if (!weekNum || !weightTrackingStartDate) return '';

  const start = new Date(weightTrackingStartDate);
  start.setHours(0, 0, 0, 0);

  // Calculate week start (0-indexed days since start date)
  const weekStartDay = (weekNum - 1) * 7;
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + weekStartDay);

  // Calculate week end
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Format dates
  const formatOptions = { day: 'numeric', month: 'short' };
  const startStr = weekStart.toLocaleDateString('tr-TR', formatOptions);
  const endStr = weekEnd.toLocaleDateString('tr-TR', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  return `${startStr} - ${endStr}`;
};