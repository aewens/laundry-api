import {
  COMMAND_PATH,
  HOMEPAGE_HOST,
  HOMEPAGE_PATH,
  USERNAME,
} from 'src/utils/constants';
import parseBookingResponse from 'src/utils/parseCommandResponse';
import AuthSession from 'src/AuthSession';
import { Timeslot } from 'src/types';
import padInt from 'src/utils/padInt';

class ApiModel {
  private session: AuthSession;

  async fetchWeek(weekOffset = 0) {
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
    return res.data;
  }

  async fetchTestWeek(weekOffset = 0) {
    const { readFile: readFileCb } = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(readFileCb);
    const buf = await readFile(`tests/week${weekOffset}.html`);
    return buf;
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
    return this.session.doApiRequest(url, {
      includeSessionSearchParams: true,
    });
  }

  async book({ groupId, start, passNumber }: Timeslot) {
    const date = `${padInt(start.getUTCFullYear())}-${padInt(
      start.getUTCMonth() + 1,
      2,
    )}-${padInt(start.getUTCDate())} 00:00:00`;
    const buf = (
      await this.command('book', {
        groupId,
        date,
        passNumber,
      })
    ).data;
    if (buf == null) {
      throw new Error('Got no data from command');
    }
    return parseBookingResponse(buf);
  }

  async testBook(_input: unknown, filename = 'successBooking') {
    const { readFile: readFileCb } = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(readFileCb);
    const buf = await readFile(`tests/booking/${filename}.html`);
    return parseBookingResponse(buf);
  }

  constructor() {
    this.session = new AuthSession(USERNAME);
  }
}

const apiModel = new ApiModel();

export default apiModel;
