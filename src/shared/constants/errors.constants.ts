import { HttpStatus } from '@nestjs/common';

export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',

  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',

  COMPANY_ALREADY_EXISTS: 'COMPANY_ALREADY_EXISTS',
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',

  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_EMAIL: 'VALIDATION_INVALID_EMAIL',
  VALIDATION_MIN_LENGTH: 'VALIDATION_MIN_LENGTH',

  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERRORS: Record<
  ErrorCode,
  { code: ErrorCode; message: string; status: HttpStatus }
> = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: {
    code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    message: 'Email ou senha inválidos',
    status: HttpStatus.UNAUTHORIZED,
  },
  [ERROR_CODES.AUTH_UNAUTHORIZED]: {
    code: ERROR_CODES.AUTH_UNAUTHORIZED,
    message: 'Acesso negado',
    status: HttpStatus.UNAUTHORIZED,
  },
  [ERROR_CODES.AUTH_TOKEN_MISSING]: {
    code: ERROR_CODES.AUTH_TOKEN_MISSING,
    message: 'Autenticação inválida! Token não fornecido.',
    status: HttpStatus.UNAUTHORIZED,
  },
  [ERROR_CODES.AUTH_TOKEN_INVALID]: {
    code: ERROR_CODES.AUTH_TOKEN_INVALID,
    message: 'Acesso negado. Token inválido ou expirado.',
    status: HttpStatus.UNAUTHORIZED,
  },
  [ERROR_CODES.USER_ALREADY_EXISTS]: {
    code: ERROR_CODES.USER_ALREADY_EXISTS,
    message: 'Usuário já cadastrado',
    status: HttpStatus.CONFLICT,
  },
  [ERROR_CODES.USER_NOT_FOUND]: {
    code: ERROR_CODES.USER_NOT_FOUND,
    message: 'Usuário não encontrado',
    status: HttpStatus.NOT_FOUND,
  },
  [ERROR_CODES.USER_EMAIL_ALREADY_EXISTS]: {
    code: ERROR_CODES.USER_EMAIL_ALREADY_EXISTS,
    message: 'Email já cadastrado',
    status: HttpStatus.CONFLICT,
  },
  [ERROR_CODES.COMPANY_ALREADY_EXISTS]: {
    code: ERROR_CODES.COMPANY_ALREADY_EXISTS,
    message: 'Empresa já cadastrada',
    status: HttpStatus.CONFLICT,
  },
  [ERROR_CODES.COMPANY_NOT_FOUND]: {
    code: ERROR_CODES.COMPANY_NOT_FOUND,
    message: 'Empresa não encontrada',
    status: HttpStatus.NOT_FOUND,
  },
  [ERROR_CODES.VALIDATION_FAILED]: {
    code: ERROR_CODES.VALIDATION_FAILED,
    message: 'Falha de validação',
    status: HttpStatus.BAD_REQUEST,
  },
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: {
    code: ERROR_CODES.VALIDATION_REQUIRED_FIELD,
    message: 'Campo obrigatório',
    status: HttpStatus.BAD_REQUEST,
  },
  [ERROR_CODES.VALIDATION_INVALID_EMAIL]: {
    code: ERROR_CODES.VALIDATION_INVALID_EMAIL,
    message: 'Email inválido',
    status: HttpStatus.BAD_REQUEST,
  },
  [ERROR_CODES.VALIDATION_MIN_LENGTH]: {
    code: ERROR_CODES.VALIDATION_MIN_LENGTH,
    message: 'Tamanho mínimo inválido',
    status: HttpStatus.BAD_REQUEST,
  },
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: {
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'Erro interno do servidor',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
  [ERROR_CODES.BAD_REQUEST]: {
    code: ERROR_CODES.BAD_REQUEST,
    message: 'Requisição inválida',
    status: HttpStatus.BAD_REQUEST,
  },
  [ERROR_CODES.UNKNOWN_ERROR]: {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: 'Erro desconhecido',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
};
