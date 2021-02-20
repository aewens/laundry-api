/* eslint-disable no-console */
import apiModel from './APIModel';

apiModel.fetchTestWeek(0).then(() => console.log('Success'), console.error);
