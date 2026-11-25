import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/health/health.controller';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;
  const principal = { authenticate: jest.fn() };
  const declaranet = { authenticate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: getConnectionToken(), useValue: principal },
        { provide: getConnectionToken('declaranet'), useValue: declaranet },
      ],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health responde ok con ambas conexiones', async () => {
    principal.authenticate.mockResolvedValue(undefined);
    declaranet.authenticate.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      principal: 'ok',
      declaranet: 'ok',
    });
  });

  it('GET /api/health marca error si una conexión falla', async () => {
    principal.authenticate.mockResolvedValue(undefined);
    declaranet.authenticate.mockRejectedValue(new Error('sin conexión'));

    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.body).toEqual({
      status: 'error',
      principal: 'ok',
      declaranet: 'error',
    });
  });
});
