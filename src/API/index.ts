import {
  COMMAND_PATH,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  USERNAME,
} from 'src/utils/constants';
import { Timeslot } from 'src/types';
import padInt from 'src/utils/padInt';
import AuthSession from './AuthSession';
import parseWeek from './parseWeek';
import parseCommandResponse from './parseCommandResponse';
import parseBookedTimes from './parseBookedTimes';

class ApiModel {
  private session: AuthSession;

  async fetchWeek(weekOffset = 0): Promise<Timeslot[]> {
    const url = new URL(`https://${HOMEPAGE_HOST}${HOMEPAGE_PATH}`);
    if (!Number.isInteger(weekOffset)) {
      throw new TypeError('weekOffset must be an integer');
    }
    url.searchParams.set('weekOffset', weekOffset.toFixed(0));
    const res = await this.session.doApiRequest(url, {
      includeSessionSearchParams: true,
    });
    if (res.statusCode !== 200) {
      throw new Error('Non-success http status code');
    }
    if (res.data == null) throw new Error('No data received');
    try {
      const { writeFile: writeFileCb } = await import('fs');
      const { promisify } = await import('util');
      const writeFile = promisify(writeFileCb);
      await writeFile(`tests/week${weekOffset}.html`, res.data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    return parseWeek(res.data);
  }

  async fetchTestWeek(weekOffset = 0): Promise<Timeslot[]> {
    const { readFile: readFileCb } = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(readFileCb);
    const buf = await readFile(`tests/week${weekOffset}.html`);
    return parseWeek(buf);
  }

  async fetchTestBookedTimes(type = 'SingleEntry'): Promise<Timeslot[]> {
    const { readFile: readFileCb } = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(readFileCb);
    const buf = await readFile(`tests/booking/listBookings${type}.html`);
    return parseBookedTimes(buf);
  }

  async command(
    name: string,
    args: Record<string, string | number | boolean> = {},
  ) {
    const url = new URL(`https://${HOMEPAGE_HOST}${COMMAND_PATH}`);
    url.searchParams.set('command', name);
    for (const [key, val] of Object.entries(args)) {
      let parsedVal: string;
      switch (typeof val) {
        case 'string':
          parsedVal = val;
          break;
        case 'boolean':
          parsedVal = val ? 'true' : 'false';
          break;
        default:
          parsedVal = val.toString();
      }
      url.searchParams.set(key, parsedVal);
    }
    const res = await this.session.doApiRequest(url, {
      includeSessionSearchParams: true,
    });
    if (res.data == null) {
      throw new Error('Got no data from command');
    }
    return parseCommandResponse(res.data);
  }

  book({ groupId, start, passNumber }: Timeslot) {
    const date = `${padInt(start.getUTCFullYear())}-${padInt(
      start.getUTCMonth() + 1,
      2,
    )}-${padInt(start.getUTCDate())} 00:00:00`;
    return this.command('book', {
      groupId,
      date,
      passNumber,
    });
  }

  async testBook(_input: unknown, filename = 'successBooking') {
    const { readFile: readFileCb } = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(readFileCb);
    const buf = await readFile(`tests/booking/${filename}.html`);
    return parseCommandResponse(buf);
  }

  constructor() {
    this.session = new AuthSession(USERNAME);
  }
}

const apiModel = new ApiModel();

export default apiModel;
