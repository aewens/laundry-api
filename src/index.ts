/* eslint-disable no-console */
import apiModel from 'src/API';

(async () => {
  console.log(await apiModel.fetchTestBookedTimes('NoEntry'));
})().catch(console.error);
