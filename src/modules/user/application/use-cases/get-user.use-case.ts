import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { NotFoundException } from 'src/shared/exceptions/business.exception';
import { UserEntity } from '../../domain/entities/user.entity';
import { toUserResponse } from './user-response.mapper';

@Injectable()
export class GetUserUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async execute(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { company: true },
    });

    if (!user) {
      throw new NotFoundException(ERROR_CODES.USER_NOT_FOUND);
    }

    return toUserResponse(user);
  }
}
