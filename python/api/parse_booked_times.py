#from collections import namedtuple
#from asyncio import get_event_loop
#from time import time
#from urllib.parse import urljoin
from bs4 import BeautifulSoup # <-- HTML scraper

from utils.constants import Status
from utils.erros import HTMLMismatchError
from utils.types import TimeSlot, TimeRange
from utils.isoweek import week_from_date

from urllib.parse import urljoin, urlsplit, parse_qs
from re import compile as regex
from datetime import datetime, timezone

is_date = regex(r"^\d{4,}-\d{2}-\d{2}$")
is_time_range = regex(r"^\s*(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*$")

def parse_url(url, time_range):
    params = dict()
    for key, value in parse_qs(urlsplit(url).query).items():
        params[key] = value[0]

    no_find = "Cannot find '{}' in URL"
    not_int = "'{}' is not valid integer"

    gi = "groupId"
    group_id = params.get(gi)
    if group_id is None:
        raise HTMLMismatchError(no_find.format(gi))

    if not group_id.isnumeric():
        raise HTMLMismatchError(not_int.format(gi))

    pn = "passNumber"
    pass_number = params.get(pn)
    if pass_number is None:
        raise HTMLMismatchError(no_find.format(pn))

    if not pass_number.isnumeric():
        raise HTMLMismatchError(not_int.format(pn))

    dt = "date"
    date = params.get(dt)
    if date is None:
        raise HTMLMismatchError(no_find.format(pn))

    if not is_date.match(date):
        raise HTMLMismatchError(f"'{dt}' is not a valid date")

    year, month, day = tuple(map(lambda s: int(s), date.split("-", 3)))

    s_hour = time_range.start.hour
    s_minute = time_range.start.minute
    start = datetime(year, month, day, s_hour, s_minute, tzinfo=timezone.utc)

    e_hour = time_range.end.hour
    e_minute = time_range.end.minute
    end = datetime(year, month, day, e_hour, e_minute, tzinfo=timezone.utc)

    iso_week = week_from_date(start)
    return iso_week, int(group_id), int(pass_number), start, end

def parse_booked_times(html):
    if not isinstance(html, str):
        html = html.decode()

    soup = BeautifulSoup(html)
    main_table = soup.find(class_="bgActiveColor") # yes, class_
    if main_table is None:
        raise HTMLMismatchError("Cannot find main table")

    has_error = main_table.find(color="#FF4500")
    if has_error is not None:
        diag = has_error.get_text()
        raise Exception(f"Got error dialogue when listing booked time: {diag}")

    images = main_table.find_all("img", src="Images/pil2_right.gif")
    url_regex = regex(r"\s*:\s*location\s*.\s*href\s*=\s*'(.*)'\s*$")
    for image in images:
        parent = image.parent
        url = None
        time_range = None

        mousedown = parent.attrs.get("onmousedown")
        if mousedown and mousedown.startswith("javascript:"):
            prefix, suffix = mousedown.split(":", 1)
            if "=" in suffix:
                href, value = suffix.split("=", 1)
                quoted, after = value.split(";", 1)
                url = quoted[1:-1]


"""
import { load } from 'cheerio';

export default function parseBookedTimes(html: Buffer | string): Timeslot[] {
  return $('img[src="Images/pil2_right.gif"]', mainTable)
    .toArray()
    .map((e) => {
      const parent = $(e.parent);
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
"""
