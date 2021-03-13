import { load } from 'cheerio';
import { HTMLMismatchError } from 'src/utils/errors';
import { Cheerio, Root } from 'src/types';

export enum Status {
  Ok = 'ok',
  MaxReachedError = 'max-reached-error',
  StartedError = 'started-error',
  AmbigiousError = 'ambigious-error',
  UnknownError = 'unknown-error',
}

export enum Action {
  Booking = 'book',
  Unbooking = 'unbook',
  Unknown = 'unknown',
}

export interface ErrorResponse {
  status: Exclude<Status, Status.Ok>;
  message: string;
  rawMessage: string;
}

export interface SuccessResponse {
  status: Status.Ok;
  action: Action;
  rawAction: string;
}

export type Response = ErrorResponse | SuccessResponse;

const actionMap: Partial<Record<string, Action>> = {
  bokning: Action.Booking,
  avbokning: Action.Unbooking,
};

const errorMap: Partial<Record<string, Exclude<Status, Status.Ok>>> = {
  'max antal framtida bokningar överskridet.': Status.MaxReachedError,
  'inte tillåtet att avboka ett startat pass.': Status.StartedError,
  'specified argument was out of the range of valid values.\nparameter name: index':
    Status.AmbigiousError,
};

const errorMessages: Record<
  Exclude<Status, Status.Ok | Status.UnknownError>,
  string
> = {
  [Status.MaxReachedError]: 'Maximum number of simultaneous bookings reached.',
  [Status.StartedError]: 'You cannot unbook a time that has already started.',
  [Status.AmbigiousError]:
    'Invalid timeslot. It could be expired, not yet available or already taken.',
};

function parseErrorResponse($: Root, mainTable: Cheerio): ErrorResponse {
  const errorEl = $('[color="#FF4500"]', mainTable).first();
  if (errorEl.length !== 1) {
    throw new HTMLMismatchError('Could not find errorText');
  }
  const errorText = errorEl.text();
  const status = errorMap[errorText.toLowerCase()] ?? Status.UnknownError;
  return {
    status,
    message:
      status === Status.UnknownError
        ? `Unknown Error: ${errorText}`
        : errorMessages[status],
    rawMessage: errorText,
  };
}

export default function parseCommandResponse(html: Buffer | string): Response {
  // eslint-disable-next-line no-param-reassign
  if (html instanceof Buffer) html = html.toString('utf-8');
  const $ = load(html);
  const mainTable = $('.bgActiveColor');
  if (mainTable.length !== 1) {
    throw new HTMLMismatchError('Could not find main response table');
  }
  const actionTitle = $('.bigText.headerColor', mainTable).first();
  const match = actionTitle.text().match(/^\s*(.*)\s+utförd:\s*$/);
  if (actionTitle.length !== 1 || !match) {
    return parseErrorResponse($, mainTable);
  }
  const action = actionMap[match[1].toLowerCase()] ?? Action.Unknown;
  return {
    status: Status.Ok,
    action,
    rawAction: match[1],
  };
}
