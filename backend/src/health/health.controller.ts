import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

type Estado = 'ok' | 'error';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly principal: Sequelize,
    @InjectConnection('declaranet') private readonly declaranet: Sequelize,
  ) {}

  @Get()
  async check() {
    const [principal, declaranet] = await Promise.all([
      this.probar(this.principal),
      this.probar(this.declaranet),
    ]);
    return {
      status: principal === 'ok' && declaranet === 'ok' ? 'ok' : 'error',
      principal,
      declaranet,
    };
  }

  private async probar(conexion: Sequelize): Promise<Estado> {
    try {
      await conexion.authenticate();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
