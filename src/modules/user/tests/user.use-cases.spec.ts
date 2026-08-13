import * as argon2 from 'argon2';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  NotFoundException,
} from 'src/shared/exceptions/business.exception';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { DeleteUserUseCase } from '../application/use-cases/delete-user.use-case';
import { GetUserUseCase } from '../application/use-cases/get-user.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';

jest.mock('argon2', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}));

function createRepositoryMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn((value) =>
      Promise.resolve({
        id: value.id ?? 'user-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        ...value,
      }),
    ),
    find: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
  };
}

const company = {
  id: 'company-id',
  name: 'Linkbuds',
  email: 'hello@linkbuds.com',
};

describe('User use cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user in the authenticated company and strips password', async () => {
    const userRepository = createRepositoryMock();
    const companyRepository = createRepositoryMock();
    companyRepository.findOne.mockResolvedValue(company);
    userRepository.findOne.mockResolvedValue(null);
    const useCase = new CreateUserUseCase(
      userRepository as never,
      companyRepository as never,
    );

    const result = await useCase.execute(
      { id: 'actor-id', companyId: 'company-id' },
      {
        name: ' User ',
        email: ' USER@LINKBUDS.COM ',
        password: 'secret123',
      },
    );

    expect(argon2.hash).toHaveBeenCalledWith('secret123');
    expect(result).toMatchObject({
      id: 'user-id',
      name: 'User',
      email: 'user@linkbuds.com',
    });
    expect(result).not.toHaveProperty('password');
  });

  it('rejects duplicate user email', async () => {
    const userRepository = createRepositoryMock();
    const companyRepository = createRepositoryMock();
    companyRepository.findOne.mockResolvedValue(company);
    userRepository.findOne.mockResolvedValue({ id: 'existing-user' });
    const useCase = new CreateUserUseCase(
      userRepository as never,
      companyRepository as never,
    );

    await expect(
      useCase.execute(
        { id: 'actor-id', companyId: 'company-id' },
        { name: 'User', email: 'user@linkbuds.com', password: 'secret123' },
      ),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.USER_EMAIL_ALREADY_EXISTS,
    });
  });

  it('lists users without passwords', async () => {
    const repository = createRepositoryMock();
    repository.find.mockResolvedValue([
      {
        id: 'user-id',
        name: 'User',
        email: 'user@linkbuds.com',
        password: 'hidden',
        company,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]);
    const useCase = new ListUsersUseCase(repository as never);

    const [result] = await useCase.execute('company-id');

    expect(result).not.toHaveProperty('password');
  });

  it('gets one user or throws not found', async () => {
    const repository = createRepositoryMock();
    repository.findOne.mockResolvedValue(null);
    const useCase = new GetUserUseCase(repository as never);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a user and protects unique email', async () => {
    const userRepository = createRepositoryMock();
    const companyRepository = createRepositoryMock();
    userRepository.findOne
      .mockResolvedValueOnce({
        id: 'user-id',
        name: 'Old',
        email: 'old@linkbuds.com',
        company,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'other-user',
        email: 'new@linkbuds.com',
      });
    const useCase = new UpdateUserUseCase(
      userRepository as never,
      companyRepository as never,
    );

    await expect(
      useCase.execute('user-id', { email: 'new@linkbuds.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft deletes a user', async () => {
    const repository = createRepositoryMock();
    repository.findOne.mockResolvedValue({ id: 'user-id' });
    const useCase = new DeleteUserUseCase(repository as never);

    await expect(useCase.execute('user-id')).resolves.toEqual({
      message: 'Usuário removido com sucesso',
    });
    expect(repository.softDelete).toHaveBeenCalledWith('user-id');
  });
});
