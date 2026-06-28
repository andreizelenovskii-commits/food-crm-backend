export class AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;

  constructor(message: string, options: {
    code?: string;
    statusCode?: number;
    details?: unknown;
  } = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {}

export class AuthenticationError extends AppError {}

export class ConflictError extends AppError {
  constructor(message: string, options: { code?: string; details?: unknown } = {}) {
    super(message, {
      code: options.code,
      statusCode: 409,
      details: options.details,
    });
  }
}
