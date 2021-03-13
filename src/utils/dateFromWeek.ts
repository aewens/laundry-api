export default function dateFromWeek(week: number, year: number): Date {
  const dateObj = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = dateObj.getUTCDay();
  if (dow <= 4) {
    dateObj.setUTCDate(dateObj.getUTCDate() - dateObj.getUTCDay() + 1);
  } else {
    dateObj.setUTCDate(dateObj.getUTCDate() + 8 - dateObj.getUTCDay());
  }
  return dateObj;
}
