import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { LinkPageEntity } from 'src/modules/link-page/domain/entities/link-page.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { provisionAccount } from '../application/provision-account';
import { GetSessionUseCase } from '../application/use-cases/get-session.use-case';
import { RegisterUserAndCompanyUseCase } from '../application/use-cases/register-user-and-company.use-case';

const signUpEmail = jest.fn();

jest.mock('../infra/better-auth.config', () => ({
  getBetterAuth: () => Promise.resolve({ api: { signUpEmail } }),
}));

const AUTH_USER_ID = '2b1f6f0e-4c6f-4a52-9b1e-6d1f8c3a7e10';
const query = jest.fn(() => Promise.resolve());

function createRepositoryMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn((value) =>
      Promise.resolve({
        id: value.id ?? 'generated-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        ...value,
      }),
    ),
    findOne: jest.fn(),
    existsBy: jest.fn(() => Promise.resolve(false)),
  };
}

function createDataSource() {
  const companyRepository = createRepositoryMock();
  const planRepository = createRepositoryMock();
  const userRepository = createRepositoryMock();
  const linkPageRepository = createRepositoryMock();
  const repositories = new Map<unknown, typeof userRepository>([
    [CompanyEntity, companyRepository],
    [PlanEntity, planRepository],
    [UserEntity, userRepository],
    [LinkPageEntity, linkPageRepository],
  ]);
  const getRepository = (entity: unknown) => repositories.get(entity);
  const dataSource = {
    getRepository,
    transaction: jest.fn((callback) =>
      Promise.resolve(callback({ query, getRepository })),
    ),
  };

  return {
    dataSource,
    companyRepository,
    planRepository,
    userRepository,
    linkPageRepository,
  };
}

describe('Auth use cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers through better-auth and provisions company, user and agency page', async () => {
    const {
      dataSource,
      companyRepository,
      planRepository,
      userRepository,
      linkPageRepository,
    } = createDataSource();
    linkPageRepository.existsBy
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    planRepository.findOne.mockResolvedValue({ id: 'free-plan-id' });
    userRepository.findOne.mockResolvedValue(null);
    signUpEmail.mockResolvedValue({
      user: { id: AUTH_USER_ID, name: 'User', email: 'user@linkbuds.com' },
    });
    const useCase = new RegisterUserAndCompanyUseCase(dataSource as never);

    await expect(
      useCase.execute({
        name: ' User ',
        email: ' USER@LINKBUDS.COM ',
        password: 'secret123',
        companyName: ' Linkbuds ',
      }),
    ).resolves.toEqual({ ok: true });

    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        name: 'User',
        email: 'user@linkbuds.com',
        password: 'secret123',
      },
    });
    expect(companyRepository.create).toHaveBeenCalledWith({
      name: 'Linkbuds',
      email: 'user@linkbuds.com',
      planId: 'free-plan-id',
    });
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: AUTH_USER_ID, role: 'OWNER' }),
    );
    // Agency name drives the page; "linkbuds" is taken, so a suffix is appended.
    expect(linkPageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AGENCY',
        status: 'ACTIVE',
        name: 'Linkbuds',
        title: 'Linkbuds',
        slug: expect.stringMatching(/^linkbuds-[0-9a-f]{6}$/),
      }),
    );
  });

  it('rejects registration before creating credentials when the free plan is missing', async () => {
    const { dataSource, planRepository } = createDataSource();
    planRepository.findOne.mockResolvedValue(null);
    const useCase = new RegisterUserAndCompanyUseCase(dataSource as never);

    await expect(
      useCase.execute({
        name: 'User',
        email: 'user@linkbuds.com',
        password: 'secret123',
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_PLAN_REQUIRED,
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('maps better-auth duplicate email to a conflict', async () => {
    const { dataSource, planRepository } = createDataSource();
    planRepository.findOne.mockResolvedValue({ id: 'free-plan-id' });
    signUpEmail.mockRejectedValue({
      body: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
    });
    const useCase = new RegisterUserAndCompanyUseCase(dataSource as never);

    await expect(
      useCase.execute({
        name: 'User',
        email: 'user@linkbuds.com',
        password: 'secret123',
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.USER_EMAIL_ALREADY_EXISTS,
    });
  });

  it('provisions idempotently: existing user is returned untouched', async () => {
    const { dataSource, companyRepository, userRepository } =
      createDataSource();
    const existing = {
      id: AUTH_USER_ID,
      company: { id: 'company-id' },
      deletedAt: null,
    };
    userRepository.findOne.mockResolvedValue(existing);

    await expect(
      provisionAccount(dataSource as never, {
        id: AUTH_USER_ID,
        name: 'User',
        email: 'user@linkbuds.com',
      }),
    ).resolves.toBe(existing);
    expect(companyRepository.save).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects provisioning of soft-deleted users', async () => {
    const { dataSource, userRepository } = createDataSource();
    userRepository.findOne.mockResolvedValue({
      id: AUTH_USER_ID,
      deletedAt: new Date(),
    });
    const identity = { id: AUTH_USER_ID, name: 'U', email: 'u@linkbuds.com' };

    await expect(
      provisionAccount(dataSource as never, identity),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.AUTH_UNAUTHORIZED });
  });

  it('returns session with identity data and entitlements', async () => {
    const userRepository = createRepositoryMock();
    userRepository.findOne.mockResolvedValue({
      id: 'user-id',
      role: 'OWNER',
      identity: { name: 'User', email: 'user@linkbuds.com', image: null },
      company: {
        id: 'company-id',
        name: 'Agência X',
        email: 'user@linkbuds.com',
        plan: {
          code: 'FREE',
          name: 'Grátis',
          maxClientPages: 1,
          analyticsTier: 'BASIC',
          customDomain: true,
          whiteLabel: false,
        },
        conditions: [],
      },
      createdAt: new Date(),
    });
    const useCase = new GetSessionUseCase(userRepository as never);

    const result = await useCase.execute({
      id: 'user-id',
      companyId: 'company-id',
      role: UserRole.OWNER,
    });

    expect(result.user).toMatchObject({
      name: 'User',
      email: 'user@linkbuds.com',
      role: 'OWNER',
    });
    expect(result.company).toMatchObject({
      id: 'company-id',
      plan: { code: 'FREE' },
      entitlements: { maxClientPages: 1, whiteLabel: false, custom: false },
    });
  });

  it('fails session when user is missing', async () => {
    const userRepository = createRepositoryMock();
    userRepository.findOne.mockResolvedValue(null);
    const useCase = new GetSessionUseCase(userRepository as never);

    await expect(
      useCase.execute({
        id: 'missing',
        companyId: 'company-id',
        role: UserRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});
