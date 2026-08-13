import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  NotFoundException,
} from 'src/shared/exceptions/business.exception';
import { CreateCompanyUseCase } from '../application/use-cases/create-company.use-case';
import { DeleteCompanyUseCase } from '../application/use-cases/delete-company.use-case';
import { GetCompanyUseCase } from '../application/use-cases/get-company.use-case';
import { ListCompaniesUseCase } from '../application/use-cases/list-companies.use-case';
import { UpdateCompanyUseCase } from '../application/use-cases/update-company.use-case';

function createRepositoryMock() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn((value) =>
      Promise.resolve({
        id: value.id ?? 'company-id',
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

describe('Company use cases', () => {
  it('creates a company with normalized email', async () => {
    const repository = createRepositoryMock();
    repository.findOne.mockResolvedValue(null);
    const useCase = new CreateCompanyUseCase(repository as never);

    const result = await useCase.execute({
      name: ' Linkbuds ',
      email: ' HELLO@LINKBUDS.COM ',
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Linkbuds',
      email: 'hello@linkbuds.com',
    });
    expect(result).toMatchObject({
      name: 'Linkbuds',
      email: 'hello@linkbuds.com',
    });
  });

  it('rejects duplicate company email', async () => {
    const repository = createRepositoryMock();
    repository.findOne.mockResolvedValue({ id: 'existing-company' });
    const useCase = new CreateCompanyUseCase(repository as never);

    await expect(
      useCase.execute({ name: 'Linkbuds', email: 'hello@linkbuds.com' }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.COMPANY_ALREADY_EXISTS,
    });
  });

  it('lists companies', async () => {
    const repository = createRepositoryMock();
    repository.find.mockResolvedValue([
      {
        id: 'company-id',
        name: 'Linkbuds',
        email: 'hello@linkbuds.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]);
    const useCase = new ListCompaniesUseCase(repository as never);

    await expect(useCase.execute()).resolves.toHaveLength(1);
  });

  it('gets one company or throws not found', async () => {
    const repository = createRepositoryMock();
    repository.findOne.mockResolvedValue(null);
    const useCase = new GetCompanyUseCase(repository as never);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a company and protects unique email', async () => {
    const repository = createRepositoryMock();
    repository.findOne
      .mockResolvedValueOnce({
        id: 'company-id',
        name: 'Old',
        email: 'old@linkbuds.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'other-company',
        email: 'new@linkbuds.com',
      });
    const useCase = new UpdateCompanyUseCase(repository as never);

    await expect(
      useCase.execute('company-id', { email: 'new@linkbuds.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft deletes a company', async () => {
    const repository = createRepositoryMock();
    repository.findOne.mockResolvedValue({ id: 'company-id' });
    const useCase = new DeleteCompanyUseCase(repository as never);

    await expect(useCase.execute('company-id')).resolves.toEqual({
      message: 'Empresa removida com sucesso',
    });
    expect(repository.softDelete).toHaveBeenCalledWith('company-id');
  });
});
