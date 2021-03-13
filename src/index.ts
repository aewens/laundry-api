/* eslint-disable no-console */
import apiModel from 'src/APIModel';
import parseWeek from 'src/utils/parseWeek';
import { Status } from './utils/constants';

const TESTING = true;
(async () => {
  const slots = await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      apiModel[TESTING ? 'fetchTestWeek' : 'fetchWeek'](i).then(parseWeek),
    ),
  ).then(([first, ...rest]) => first.concat(...rest));
  const slot = slots.find(({ status }) => status === Status.Available);
  if (!slot) throw new Error('no available slot');
  console.log(await apiModel.testBook(slot, 'failureStarted'));
})().catch(console.error);
