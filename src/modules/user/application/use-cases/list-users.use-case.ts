import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../domain/entities/user.entity';
import { toUserResponse } from './user-response.mapper';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async execute(companyId?: string) {
    const users = await this.userRepository.find({
      where: companyId ? { company: { id: companyId } } : {},
      relations: { company: true },
      order: { createdAt: 'DESC' },
    });

    return users.map(toUserResponse);
  }
}
