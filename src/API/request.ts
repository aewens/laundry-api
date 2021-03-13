/* eslint-disable import/prefer-default-export */
import type { CookieJar } from 'cookiejar';
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from 'http';
import https, { RequestOptions } from 'https';

export interface RequestResponse {
  statusCode: number | undefined;
  headers: IncomingHttpHeaders;
  data: Buffer | null;
  rawResponse: IncomingMessage;
  rawRequest: ClientRequest;
}

export function request(
  url: string | URL,
  options: RequestOptions = {},
  cookieJar?: CookieJar,
): Promise<RequestResponse> {
  // eslint-disable-next-line no-param-reassign
  url = typeof url === 'string' ? new URL(url) : url;
  if (cookieJar && !options.headers?.cookie) {
    const cookies = cookieJar.getCookies({
      domain: url.hostname,
      secure: true,
      path: url.pathname,
      script: false,
    });
    const cookie = cookies.map((c) => c.toValueString());
    // eslint-disable-next-line no-param-reassign
    options = { ...options, headers: { ...options.headers, cookie } };
  }
  return new Promise<RequestResponse>((_resolve, _reject) => {
    let isResolved = false;
    function reject(err: Error) {
      if (isResolved) return;
      isResolved = true;
      _reject(err);
    }
    function resolve(value: RequestResponse | PromiseLike<RequestResponse>) {
      if (isResolved) return;
      isResolved = true;
      _resolve(value);
    }
    const req = https.request(url, options, (res) => {
      const data: Buffer[] = [];
      let rcvd = 0;
      let contentBuffer: Buffer | null = null;
      if (res.headers['content-length'] != null) {
        const contentLength = Number.parseInt(
          res.headers['content-length'],
          10,
        );
        if (!Number.isNaN(contentLength) && contentLength > 0) {
          contentBuffer = Buffer.allocUnsafe(contentLength);
        }
      }
      res.on('data', (chunk: Buffer) => {
        if (contentBuffer) {
          if (rcvd + chunk.length <= contentBuffer.length) {
            chunk.copy(contentBuffer, rcvd);
          } else {
            data.push(contentBuffer);
            chunk.copy(contentBuffer, rcvd, 0, contentBuffer.length - rcvd);
            // eslint-disable-next-line no-param-reassign
            chunk = chunk.slice(contentBuffer.length - rcvd);
            contentBuffer = null;
          }
        }
        if (!contentBuffer) {
          data.push(chunk);
        }
        rcvd += chunk.length;
      });
      res.on('error', reject);
      res.on('end', () => {
        if (res.complete) {
          if (rcvd !== 0) {
            if (contentBuffer) {
              if (contentBuffer.length !== rcvd) {
                contentBuffer = contentBuffer?.slice(0, rcvd);
              }
            } else {
              contentBuffer = Buffer.allocUnsafe(rcvd);
              let pos = rcvd;
              let chunk;
              // Read the data in reverse so we can pop the data
              // and mark for GC immediately.
              while ((chunk = data.pop()) != null) {
                chunk.copy(contentBuffer, pos - chunk.length);
                pos -= chunk.length;
              }
            }
          } else {
            contentBuffer = null;
          }
          if (cookieJar && res.headers['set-cookie']) {
            const cookies = res.headers['set-cookie'];
            cookieJar.setCookies(cookies, req.host, req.path);
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: contentBuffer,
            rawRequest: req,
            rawResponse: res,
          });
        } else {
          reject(new Error('Connection terminated before finished'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
