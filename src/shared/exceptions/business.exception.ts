import { HttpException, HttpStatus } from '@nestjs/common';
import { ERRORS, ErrorCode } from '../constants/errors.constants';

export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    status?: HttpStatus,
    message?: string,
  ) {
    const errorDef = ERRORS[errorCode];
    const finalMessage = message || errorDef?.message || 'Unknown error';
    const finalStatus = status || errorDef?.status || HttpStatus.BAD_REQUEST;

    super({ message: finalMessage, errorCode }, finalStatus);
  }
}

export class ConflictException extends BusinessException {
  constructor(errorCode: ErrorCode, message?: string) {
    super(errorCode, HttpStatus.CONFLICT, message);
  }
}

export class NotFoundException extends BusinessException {
  constructor(errorCode: ErrorCode, message?: string) {
    super(errorCode, HttpStatus.NOT_FOUND, message);
  }
}

export class ValidationException extends BusinessException {
  constructor(errorCode: ErrorCode, message?: string) {
    super(errorCode, HttpStatus.BAD_REQUEST, message);
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(errorCode: ErrorCode, message?: string) {
    super(errorCode, HttpStatus.UNAUTHORIZED, message);
  }
}

export class ForbiddenException extends BusinessException {
  constructor(errorCode: ErrorCode, message?: string) {
    super(errorCode, HttpStatus.FORBIDDEN, message);
  }
}
