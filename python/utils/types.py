from utils.constants import Status

from typing import NamedTuple
from datetime import datetime

class TimeSlot(NamedTuple):
    pass_number: int
    group_id: int
    week_num: int
    week_num: int
    start: datetime
    end: datetime
    status: Status

class Time(NamedTuple):
    hour: int
    minute: int

class TimeRange(NamedTuple):
    start: Time
    end: Time

"""
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
"""
