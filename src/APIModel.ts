import { HOMEPAGE_HOST, HOMEPAGE_PATH, USERNAME } from './utils/constants';
import AuthSession from './AuthSession';

class ApiModel {
  private session: AuthSession;

  async fetchWeek(weekOffset = 0) {
    const url = new URL(`https://${HOMEPAGE_HOST}${HOMEPAGE_PATH}`);
    if (!Number.isInteger(weekOffset)) {
      throw new TypeError('weekOffset must be an integer');
    }
    url.searchParams.set('weekOFfset', weekOffset.toFixed(0));
    const res = await this.session.doApiRequest(url, {
      includeSessionSearchParams: true,
    });
    if (res.statusCode !== 200) {
      throw new Error('Non-success http status code');
    }
    if (res.data) {
      const { writeFile: writeFileCb } = await import('fs');
      const { promisify } = await import('util');
      const writeFile = promisify(writeFileCb);
      await writeFile(`tests/week${weekOffset}.html`, res.data);
    }
  }

  async fetchTestWeek(weekOffset = 0) {
    const { readFile: readFileCb } = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(readFileCb);
    const buf = await readFile(`tests/week${weekOffset}.html`);
    console.log(buf);
  }

  constructor() {
    this.session = new AuthSession(USERNAME);
  }
}

const apiModel = new ApiModel();

export default apiModel;
