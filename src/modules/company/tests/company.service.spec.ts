import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { CompanyService } from '../application/company.service';

describe('CompanyService.update', () => {
  const auth = (role: UserRole) =>
    ({ id: 'user-id', companyId: 'company-id', role }) as never;

  it('renames the company for the owner', async () => {
    const repository = { update: jest.fn() };
    const service = new CompanyService(repository as never);

    await expect(
      service.update(auth(UserRole.OWNER), { name: 'Nova Agência' }),
    ).resolves.toEqual({ id: 'company-id', name: 'Nova Agência' });
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'company-id' },
      { name: 'Nova Agência' },
    );
  });

  it('rejects members', async () => {
    const repository = { update: jest.fn() };
    const service = new CompanyService(repository as never);

    await expect(
      service.update(auth(UserRole.MEMBER), { name: 'X' }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.COMPANY_OWNER_REQUIRED,
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
