import type { Status } from 'src/utils/constants';
import type { load } from 'cheerio';

export type Root = typeof load extends (attr: never) => infer T ? T : never;
export type Cheerio = Root extends (...args: never[]) => infer T ? T : never;

export interface Timeslot {
  passNumber: number;
  groupId: number;
  weekNum: number;
  start: Date;
  end: Date;
  status: Status;
}

export interface Time {
  hour: number;
  minute: number;
}
export interface Timerange {
  start: Time;
  end: Time;
}
