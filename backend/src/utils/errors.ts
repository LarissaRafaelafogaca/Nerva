// Erros de aplicação com status HTTP explícito.
// Nunca inclua dados sensíveis nas mensagens.

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'app_error', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const BadRequest = (msg = 'Bad request', details?: unknown) =>
  new AppError(400, msg, 'bad_request', details);
export const Unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'unauthorized');
export const Forbidden = (msg = 'Forbidden') => new AppError(403, msg, 'forbidden');
export const NotFound = (msg = 'Not found') => new AppError(404, msg, 'not_found');
export const Conflict = (msg = 'Conflict') => new AppError(409, msg, 'conflict');
export const ValidationError = (msg = 'Validation error', details?: unknown) =>
  new AppError(422, msg, 'validation_error', details);
