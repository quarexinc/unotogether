export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, code) => new HttpError(status, code);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
