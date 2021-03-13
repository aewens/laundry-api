import { load } from 'cheerio';
import { Root, Timerange, Timeslot } from 'src/types';
import weekFromDate from 'src/utils/weekFromDate';
import dateFromWeek from 'src/utils/dateFromWeek';
import { RawStatus, statusMap } from 'src/utils/constants';
import { HTMLMismatchError } from 'src/utils/errors';

function circularMod(q: number, p: number) {
  if (q < 0) {
    return p + (q % p);
  }
  return q % p;
}

function getTargetYear(thisYear: number, thisWeek: number, targetWeek: number) {
  if (thisWeek === targetWeek) return thisYear;
  const adjustedWeek = circularMod(targetWeek - thisWeek, 53) - 26;
  switch (Math.sign(adjustedWeek)) {
    case 1:
      return thisWeek > targetWeek ? thisYear : thisYear - 1;
    case -1:
      return thisWeek < targetWeek ? thisYear : thisYear + 1;
    default:
      return thisYear;
  }
}

function addDays(curDate: Date, num = 1): Date {
  const newDate = new Date(curDate);
  newDate.setUTCDate(curDate.getUTCDate() + num);
  return newDate;
}

function getWeek(
  $: Root,
): { dates: [Date, Date, Date, Date, Date, Date, Date]; weekNum: number } {
  const weekCells = $('.BookingCalendarCurrentWeekCell');
  if (weekCells.length === 0) {
    throw new HTMLMismatchError('Could not find curretn week table cell');
  }
  const weekCell = weekCells.first();
  const weekMatch = weekCell.text().match(/\s*vecka\s*(\d+)/i);
  if (!weekMatch) {
    throw new HTMLMismatchError('Unable to decode string in week cell');
  }
  const [curYear, curWeek] = weekFromDate(new Date());
  const weekNum = Number.parseInt(weekMatch[1], 10);
  const year = getTargetYear(curYear, curWeek, weekNum);
  const monday = dateFromWeek(weekNum, year);
  const dates: [Date, Date, Date, Date, Date, Date, Date] = [
    monday,
    addDays(monday, 1),
    addDays(monday, 2),
    addDays(monday, 3),
    addDays(monday, 4),
    addDays(monday, 5),
    addDays(monday, 6),
  ];
  let curCel = weekCell.next();
  dates.forEach((d) => {
    const dateMatch = curCel
      .text()
      .match(/(?:^|[^\d])(\d{1,2}\/\d{1,2})(?:$|[^\d])/);
    if (dateMatch == null) {
      throw new HTMLMismatchError(
        'Unable to find date-like segment of weekday string.',
      );
    }
    const [, dateStr] = dateMatch;
    const expected = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    if (expected !== dateStr) {
      throw new HTMLMismatchError(
        `Date mismatch, expceted '${expected}', got '${dateStr}`,
      );
    }
    curCel = curCel.next();
  });
  return { dates, weekNum };
}

function getTimeranges($: Root): Timerange[] {
  const slotTables = $('.calendarTimeRowOuterTdInnerTable');
  if (slotTables.length === 0) {
    throw new HTMLMismatchError('Could not find curretn week table cell');
  }
  const slotTable = slotTables.first();
  const rows = $('tr', slotTable);
  return rows.toArray().map((e) => {
    const slotMatch = $(e)
      .text()
      .match(/(?:^|[^\d])(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})(?:$|[^\d])/);
    if (slotMatch == null) {
      throw new HTMLMismatchError(
        'Unable to find timerange like segment of timerange string.',
      );
    }
    const [, startStr, endStr] = slotMatch;
    const [startHour, startMinute] = startStr
      .split(':')
      .map((s) => Number.parseInt(s, 10));
    const [endHour, endMinute] = endStr
      .split(':')
      .map((s) => Number.parseInt(s, 10));
    return {
      start: {
        hour: startHour,
        minute: startMinute,
      },
      end: {
        hour: endHour,
        minute: endMinute,
      },
    };
  });
}

function getGroupId($: Root): number {
  const selected = $('#ddBookingGroup > option[selected]');
  if (selected.length !== 1) {
    throw new HTMLMismatchError(
      'Unnable to determine current bookingGroup, selected option missing.',
    );
  }
  const groupId = selected.attr('value');
  if (groupId == null) {
    throw new HTMLMismatchError(
      'Unnable to determine current bookingGroup, value attr null.',
    );
  }
  if (!/^\d+$/.test(groupId)) {
    throw new HTMLMismatchError('groupId is not a well-formed number.');
  }
  return Number.parseInt(groupId, 10);
}

function getTimeslots($: Root): Timeslot[] {
  const groupId = getGroupId($);
  const { dates: weekDates, weekNum } = getWeek($);
  const bookingTables = $('.BookingCalendarBookingIconsOuterCellInnerTable');
  if (bookingTables.length !== weekDates.length) {
    throw new HTMLMismatchError(
      `Expected ${weekDates.length} booking tables, got ${bookingTables.length}`,
    );
  }
  const timeranges = getTimeranges($);
  const timeslots: Timeslot[] = [];
  bookingTables.toArray().forEach((e, dateIndex) => {
    const imgs = $('img', e);
    if (imgs.length !== timeranges.length) {
      throw new HTMLMismatchError(
        `Expected ${timeranges.length} image rows, got ${imgs.length}`,
      );
    }
    imgs.toArray().forEach((img, slotIndex) => {
      const imgSrc = $(img).attr('src') as RawStatus | undefined;
      if (
        imgSrc == null ||
        !Object.prototype.hasOwnProperty.call(statusMap, imgSrc)
      ) {
        throw new HTMLMismatchError(
          `Unknown status image, expected one of ${Object.keys(
            statusMap,
          )} image rows, got ${imgSrc}`,
        );
      }
      const start = new Date(weekDates[dateIndex]);
      const end = new Date(weekDates[dateIndex]);
      start.setUTCHours(timeranges[slotIndex].start.hour);
      start.setUTCMinutes(timeranges[slotIndex].start.minute);
      end.setUTCHours(timeranges[slotIndex].end.hour);
      end.setUTCMinutes(timeranges[slotIndex].end.minute);
      timeslots.push({
        weekNum,
        groupId,
        start,
        end,
        status: statusMap[imgSrc],
        passNumber: slotIndex,
      });
    });
  });
  return timeslots;
}

export default function parseWeek(html: Buffer | string): Timeslot[] {
  // eslint-disable-next-line no-param-reassign
  if (html instanceof Buffer) html = html.toString('utf-8');
  const $ = load(html);
  return getTimeslots($);
}
