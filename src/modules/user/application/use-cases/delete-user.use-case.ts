import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { NotFoundException } from 'src/shared/exceptions/business.exception';
import { UserEntity } from '../../domain/entities/user.entity';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async execute(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ERROR_CODES.USER_NOT_FOUND);
    }

    await this.userRepository.softDelete(id);

    return {
      message: 'Usuário removido com sucesso',
    };
  }
}
