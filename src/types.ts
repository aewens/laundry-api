import { Status } from 'utils/constants';

export interface Timeslot {
  passNumber: number;
  groupId: number;
  weekNum: number;
  start: Date;
  end: Date;
  status: Status;
}
