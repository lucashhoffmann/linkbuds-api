import * as argon2 from 'argon2';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { NotFoundException } from 'src/shared/exceptions/business.exception';
import { GetSessionUseCase } from '../application/use-cases/get-session.use-case';
import { RegisterUserAndCompanyUseCase } from '../application/use-cases/register-user-and-company.use-case';

jest.mock('argon2', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
  verify: jest.fn(() => Promise.resolve(true)),
}));

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
  };
}

describe('Auth use cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a company and user in one transaction', async () => {
    const companyRepository = createRepositoryMock();
    const planRepository = createRepositoryMock();
    const userRepository = createRepositoryMock();
    companyRepository.findOne.mockResolvedValue(null);
    planRepository.findOne.mockResolvedValue({
      id: 'free-plan-id',
      code: 'FREE',
      active: true,
    });
    userRepository.findOne.mockResolvedValue(null);
    companyRepository.save.mockResolvedValue({
      id: 'company-id',
      name: 'Linkbuds',
      email: 'user@linkbuds.com',
    });
    userRepository.save.mockResolvedValue({
      id: 'user-id',
      name: 'User',
      email: 'user@linkbuds.com',
    });

    const dataSource = {
      transaction: jest.fn((callback) =>
        Promise.resolve(
          callback({
            query,
            getRepository: (entity: { name: string }) =>
              entity === CompanyEntity
                ? companyRepository
                : entity === PlanEntity
                  ? planRepository
                  : entity === UserEntity
                    ? userRepository
                    : userRepository,
          }),
        ),
      ),
    };
    const useCase = new RegisterUserAndCompanyUseCase(dataSource as never);

    await expect(
      useCase.execute({
        name: ' User ',
        email: ' USER@LINKBUDS.COM ',
        password: 'secret123',
        companyName: ' Linkbuds ',
      }),
    ).resolves.toEqual({ ok: true });

    expect(companyRepository.create).toHaveBeenCalledWith({
      name: 'Linkbuds',
      email: 'user@linkbuds.com',
      planId: 'free-plan-id',
    });
    expect(planRepository.findOne).toHaveBeenCalledWith({
      where: { code: 'FREE', active: true },
    });
    expect(argon2.hash).toHaveBeenCalledWith('secret123');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"user"'), [
      'user-id',
      'User',
      'user@linkbuds.com',
    ]);
  });

  it('rejects registration when the free plan is not available', async () => {
    const companyRepository = createRepositoryMock();
    const planRepository = createRepositoryMock();
    const userRepository = createRepositoryMock();
    companyRepository.findOne.mockResolvedValue(null);
    planRepository.findOne.mockResolvedValue(null);
    userRepository.findOne.mockResolvedValue(null);

    const dataSource = {
      transaction: jest.fn((callback) =>
        Promise.resolve(
          callback({
            query,
            getRepository: (entity: { name: string }) =>
              entity === CompanyEntity
                ? companyRepository
                : entity === PlanEntity
                  ? planRepository
                  : userRepository,
          }),
        ),
      ),
    };
    const useCase = new RegisterUserAndCompanyUseCase(dataSource as never);

    await expect(
      useCase.execute({
        name: 'User',
        email: 'user@linkbuds.com',
        password: 'secret123',
        companyName: 'Linkbuds',
      }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.LINK_PAGE_PLAN_REQUIRED,
    });
    expect(companyRepository.save).not.toHaveBeenCalled();
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('returns session without user password', async () => {
    const userRepository = createRepositoryMock();
    const companyRepository = createRepositoryMock();
    userRepository.findOne.mockResolvedValue({
      id: 'user-id',
      name: 'User',
      email: 'user@linkbuds.com',
      password: 'hidden',
      company: {
        id: 'company-id',
        name: 'Linkbuds',
        email: 'hello@linkbuds.com',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    companyRepository.findOne.mockResolvedValue({
      id: 'company-id',
      name: 'Linkbuds',
      email: 'hello@linkbuds.com',
      plan: {
        id: 'free-plan-id',
        name: 'Free',
        code: 'FREE',
        type: PlanType.FREE,
        maxClientPages: 1,
        priceCents: 0,
        active: true,
        analyticsEnabled: true,
        customDomainEnabled: false,
        whiteLabelEnabled: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const useCase = new GetSessionUseCase(
      userRepository as never,
      companyRepository as never,
    );

    const result = await useCase.execute({
      id: 'user-id',
      companyId: 'company-id',
    });

    expect(result.user).not.toHaveProperty('password');
    expect(result.company).toMatchObject({
      id: 'company-id',
      name: 'Linkbuds',
      plan: {
        customDomainEnabled: true,
        whiteLabelEnabled: false,
      },
    });
  });

  it('fails session when user is missing', async () => {
    const userRepository = createRepositoryMock();
    const companyRepository = createRepositoryMock();
    userRepository.findOne.mockResolvedValue(null);
    const useCase = new GetSessionUseCase(
      userRepository as never,
      companyRepository as never,
    );

    await expect(
      useCase.execute({ id: 'missing', companyId: 'company-id' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
