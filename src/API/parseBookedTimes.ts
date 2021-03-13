import { load } from 'cheerio';
import { Timeslot, Timerange } from 'src/types';
import weekFromDate from 'src/utils/weekFromDate';
import { HTMLMismatchError } from 'src/utils/errors';
import { Status } from 'src/utils/constants';

const allNums = /^\d+$/;

const timeRange = /^\s*(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*$/;

function parseUrl(url: string, timerange: Timerange) {
  const params = new URLSearchParams(url);
  const groupId = params.get('groupId');
  if (groupId == null) {
    throw new HTMLMismatchError('cannot find groupId in URL');
  }
  if (!allNums.test(groupId)) {
    throw new HTMLMismatchError('groupId is not a valid integer');
  }
  const passNumber = params.get('passNumber');
  if (passNumber == null) {
    throw new HTMLMismatchError('cannot find passNumber in URL');
  }
  if (!allNums.test(passNumber)) {
    throw new HTMLMismatchError('passNumber is not a valid integer');
  }
  const date = params.get('date');
  if (date == null) {
    throw new HTMLMismatchError('cannot find date in URL');
  }
  if (!/^\d{4,}-\d{2}-\d{2}$/.test(date)) {
    throw new HTMLMismatchError('date is not a valid date');
  }
  const [year, month, day] = date.split('-').map((s) => Number.parseInt(s, 10));
  const start = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      timerange.start.hour,
      timerange.start.minute,
    ),
  );
  const end = new Date(
    Date.UTC(year, month - 1, day, timerange.end.hour, timerange.end.minute),
  );
  const [, weekNum] = weekFromDate(start);
  return {
    weekNum,
    groupId: Number.parseInt(groupId, 10),
    passNumber: Number.parseInt(passNumber, 10),
    start,
    end,
  };
}

export default function parseBookedTimes(html: Buffer | string): Timeslot[] {
  // eslint-disable-next-line no-param-reassign
  if (html instanceof Buffer) html = html.toString('utf-8');
  const $ = load(html);
  const mainTable = $('.bgActiveColor');
  if (mainTable.length !== 1) {
    throw new HTMLMismatchError('Cannot find main table.');
  }
  const errorEl = $('[color="#FF4500"]', mainTable).first();
  if (errorEl.length > 0) {
    throw new Error(
      `Got error dialogue when listing booked times: ${errorEl.text().trim()}`,
    );
  }
  return $('img[src="Images/pil2_right.gif"]', mainTable)
    .toArray()
    .map((e) => {
      const parent = $(e.parent);
      const urlMatch = parent
        .attr('onmousedown')
        ?.match(/^\s*javascript\s*:\s*location\s*.\s*href\s*=\s*'(.*)'\s*$/);
      if (urlMatch == null) return null;
      const [, url] = urlMatch;
      const timerangeString = $('span', parent.parent('tr').next())
        .toArray()
        .map((spanEl) => $(spanEl).text())
        .find((s) => timeRange.test(s));
      const timeMatch = timerangeString?.match(timeRange);
      if (timeMatch == null) {
        throw new HTMLMismatchError('Cannot find timerange for booking entry');
      }
      const [, startHour, startMinute, endHour, endMinute] = timeMatch;

      const { groupId, passNumber, start, end, weekNum } = parseUrl(url, {
        start: {
          hour: Number.parseInt(startHour, 10),
          minute: Number.parseInt(startMinute, 10),
        },
        end: {
          hour: Number.parseInt(endHour, 10),
          minute: Number.parseInt(endMinute, 10),
        },
      });

      return {
        weekNum,
        groupId,
        start,
        end,
        status: Status.Own,
        passNumber,
      };
    })
    .filter((e): e is Timeslot => e != null);
}
