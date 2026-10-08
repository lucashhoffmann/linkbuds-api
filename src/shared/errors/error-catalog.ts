import { HttpStatus } from '@nestjs/common';

export interface ErrorDefinition {
  status: HttpStatus;
  /** Default message, in pt-BR (shown to end users). */
  message: string;
}

/**
 * Single source of truth for API errors: every code is declared once with its
 * HTTP status and default message. Add new errors here, then
 * `throw new AppException(ERROR_CODES.YOUR_CODE)`.
 */
export const ERRORS = {
  // --- Autenticação e acesso
  AUTH_UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Acesso negado',
  },
  ADMIN_UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Chave de administração inválida',
  },
  // --- Usuários e equipe
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Usuário não encontrado',
  },
  USER_EMAIL_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Email já cadastrado',
  },
  TEAM_OWNER_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Apenas o dono da conta pode gerenciar a equipe',
  },
  TEAM_SEAT_LIMIT_REACHED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Limite de usuários do plano atingido',
  },
  TEAM_INVITE_INVALID: {
    status: HttpStatus.NOT_FOUND,
    message: 'Convite inválido, expirado ou já utilizado',
  },
  TEAM_INVITE_EMAIL_MISMATCH: {
    status: HttpStatus.FORBIDDEN,
    message: 'Este convite foi enviado para outro email',
  },
  TEAM_INVITE_ALREADY_PENDING: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um convite pendente para este email',
  },
  TEAM_ALREADY_MEMBER: {
    status: HttpStatus.CONFLICT,
    message: 'Este email já faz parte de uma conta LinkBuds',
  },
  TEAM_MEMBER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Membro não encontrado',
  },
  TEAM_CANNOT_REMOVE_OWNER: {
    status: HttpStatus.FORBIDDEN,
    message: 'O dono da conta não pode ser removido',
  },
  // --- Empresa e domínio
  COMPANY_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Empresa não encontrada',
  },
  COMPANY_CONDITION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Condição não encontrada',
  },
  COMPANY_DOMAIN_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Domínio não encontrado',
  },
  COMPANY_DOMAIN_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Domínio já está em uso',
  },
  COMPANY_DOMAIN_LIMIT_REACHED: {
    status: HttpStatus.CONFLICT,
    message: 'Empresa já possui um domínio customizado ativo',
  },
  COMPANY_DOMAIN_INVALID_HOSTNAME: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Hostname inválido',
  },
  // --- Planos, cupons e cobrança
  PLAN_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Plano não encontrado',
  },
  PLAN_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um plano com este código',
  },
  BILLING_NOT_CONFIGURED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Pagamentos ainda não estão disponíveis',
  },
  BILLING_OWNER_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Apenas o dono da conta pode gerenciar a assinatura',
  },
  BILLING_PLAN_UNAVAILABLE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Plano indisponível para assinatura',
  },
  BILLING_NOTHING_TO_PAY: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Sua conta já tem este plano sem custo',
  },
  BILLING_NO_SUBSCRIPTION: {
    status: HttpStatus.NOT_FOUND,
    message: 'Nenhuma assinatura ativa',
  },
  BILLING_CHECKOUT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Checkout não encontrado',
  },
  BILLING_ALREADY_SUBSCRIBED: {
    status: HttpStatus.CONFLICT,
    message: 'Sua conta já tem uma assinatura ativa',
  },
  BILLING_UPGRADE_UNAVAILABLE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Este plano não é um upgrade da sua assinatura atual',
  },
  BILLING_QUOTE_CHANGED: {
    status: HttpStatus.CONFLICT,
    message: 'O valor mudou. Confira o novo total antes de pagar.',
  },
  BILLING_GATEWAY_ERROR: {
    status: HttpStatus.BAD_GATEWAY,
    message:
      'Não conseguimos processar o pagamento agora. Tente novamente em alguns minutos.',
  },
  BILLING_PAYMENT_DECLINED: {
    status: HttpStatus.PAYMENT_REQUIRED,
    message: 'Pagamento recusado. Confira os dados do cartão.',
  },
  BILLING_ENTRY_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Lançamento não encontrado',
  },
  BILLING_WEBHOOK_INVALID: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Webhook inválido',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Header Idempotency-Key é obrigatório',
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Idempotency-Key já usada com outro conteúdo',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    status: HttpStatus.CONFLICT,
    message: 'Requisição com esta Idempotency-Key ainda em andamento',
  },
  COUPON_INVALID: {
    status: HttpStatus.NOT_FOUND,
    message: 'Cupom inválido ou expirado',
  },
  COUPON_EXHAUSTED: { status: HttpStatus.CONFLICT, message: 'Cupom esgotado' },
  COUPON_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um cupom com este código',
  },
  // --- Páginas
  LINK_PAGE_INVALID_PARENT: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'Posts e formulários só podem ser criados dentro de uma página de bio',
  },
  LINK_PAGE_FORM_WEBHOOK_MISSING: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Configure a planilha do Google neste formulário primeiro',
  },
  LINK_PAGE_FORM_INVALID_ANSWERS: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Confira os campos destacados',
  },
  LINK_PAGE_FORM_CLOSED: {
    status: HttpStatus.CONFLICT,
    message: 'Este formulário não está mais recebendo respostas',
  },
  LINK_PAGE_FORM_ALREADY_ANSWERED: {
    status: HttpStatus.CONFLICT,
    message:
      'Já existe uma resposta registrada com este valor. Não é possível enviar o formulário novamente',
  },
  LINK_PAGE_FORM_LIMIT_TOO_LOW: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'O limite precisa ser maior que as respostas já recebidas neste corte',
  },
  LINK_PAGE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'LinkPage não encontrada',
  },
  LINK_PAGE_PLAN_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Empresa sem plano ativo',
  },
  LINK_PAGE_PLAN_LIMIT_REACHED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Limite de LinkPages do plano atingido',
  },
  LINK_PAGE_FORM_LIMIT_REACHED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Limite de formulários do plano atingido',
  },
  LINK_PAGE_SLUG_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    message: 'Este endereço já está em uso',
  },
  LINK_PAGE_AGENCY_PROTECTED: {
    status: HttpStatus.FORBIDDEN,
    message: 'A LinkPage da agência não pode ser alterada por esta operação',
  },
  LINK_PAGE_CHILD_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Item da LinkPage não encontrado',
  },
  LINK_PAGE_INVALID_LINK_CONFIGURATION: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Configuração de link inválida',
  },
  LINK_PAGE_PREVIEW_UNAVAILABLE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'Não foi possível carregar a prévia deste link',
  },
  LINK_PAGE_FEATURE_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: 'Feature não disponível no plano atual',
  },
  // --- Validação
  VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Falha de validação',
  },
  VALIDATION_REQUIRED_FIELD: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Campo obrigatório',
  },
  VALIDATION_INVALID_EMAIL: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Email inválido',
  },
  VALIDATION_MIN_LENGTH: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Tamanho mínimo inválido',
  },
  // --- Genéricos (HTTP)
  INTERNAL_SERVER_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Erro interno do servidor',
  },
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Requisição inválida',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Recurso não encontrado',
  },
  FORBIDDEN: { status: HttpStatus.FORBIDDEN, message: 'Acesso negado' },
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    message: 'Conflito com dados existentes',
  },
  PAYLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Conteúdo maior que o permitido',
  },
  TOO_MANY_REQUESTS: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Muitas requisições. Tente novamente em instantes.',
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERRORS;

/** `ERROR_CODES.X === 'X'`, for autocomplete and refactors. */
export const ERROR_CODES = Object.fromEntries(
  Object.keys(ERRORS).map((code) => [code, code]),
) as { readonly [K in ErrorCode]: K };

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERRORS;
}
