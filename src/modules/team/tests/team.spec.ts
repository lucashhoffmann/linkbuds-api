import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import {
  assertInviteEmail,
  hashInviteToken,
  inviteUrl,
  newInviteToken,
} from '../application/invite-token';
import { TeamService } from '../application/team.service';

const owner = { id: 'owner-id', companyId: 'company-id', role: UserRole.OWNER };
const member = { ...owner, id: 'member-id', role: UserRole.MEMBER };

describe('invite tokens', () => {
  it('stores only the hash and builds the public link', () => {
    process.env.PUBLIC_WEB_URL = 'https://app.linkbuds.com/';
    const { token, tokenHash } = newInviteToken();

    expect(tokenHash).toBe(hashInviteToken(token));
    expect(tokenHash).not.toContain(token);
    expect(inviteUrl(token)).toBe(`https://app.linkbuds.com/invite/${token}`);
    delete process.env.PUBLIC_WEB_URL;
  });

  it('matches invite email case-insensitively', () => {
    const invite = { email: 'ana@agencia.com' } as never;

    expect(() => assertInviteEmail(invite, ' Ana@Agencia.com ')).not.toThrow();
    expect(() => assertInviteEmail(invite, 'outra@agencia.com')).toThrow(
      expect.objectContaining({
        errorCode: ERROR_CODES.TEAM_INVITE_EMAIL_MISMATCH,
      }),
    );
  });
});

describe('TeamService', () => {
  function createService(found: unknown = null) {
    const users = {
      findOne: jest.fn().mockResolvedValue(found),
      delete: jest.fn(),
    };
    const dataSource = { getRepository: jest.fn(() => users) };

    return { service: new TeamService(dataSource as never), users };
  }

  it('only the owner manages the team', async () => {
    const { service } = createService();

    await expect(
      service.invite(member, { email: 'x@y.com' }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.TEAM_OWNER_REQUIRED });
    await expect(service.removeMember(member, 'x')).rejects.toMatchObject({
      errorCode: ERROR_CODES.TEAM_OWNER_REQUIRED,
    });
  });

  it('never removes the owner and removes members of the same company', async () => {
    const ownerRow = createService({ id: 'owner-id', role: UserRole.OWNER });
    await expect(
      ownerRow.service.removeMember(owner, 'owner-id'),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.TEAM_CANNOT_REMOVE_OWNER,
    });

    const memberRow = createService({ id: 'member-id', role: UserRole.MEMBER });
    await memberRow.service.removeMember(owner, 'member-id');
    expect(memberRow.users.findOne).toHaveBeenCalledWith({
      where: { id: 'member-id', companyId: 'company-id' },
    });
    expect(memberRow.users.delete).toHaveBeenCalledWith({ id: 'member-id' });
  });
});
