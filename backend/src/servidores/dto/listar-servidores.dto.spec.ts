import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListarServidoresDto } from './listar-servidores.dto';

const convertir = (plano: Record<string, unknown>) =>
  plainToInstance(ListarServidoresDto, plano);

describe('ListarServidoresDto', () => {
  it('usa activos por defecto', async () => {
    const dto = convertir({});
    expect(dto.estatus).toBe('activos');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('convierte obligado y dependenciaId desde la query', async () => {
    const dto = convertir({
      obligado: 'false',
      dependenciaId: '4',
      estatus: 'baja',
    });
    expect(dto.obligado).toBe(false);
    expect(dto.dependenciaId).toBe(4);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza valores inválidos', async () => {
    expect(await validate(convertir({ estatus: 'otro' }))).not.toHaveLength(0);
    expect(await validate(convertir({ obligado: 'quizas' }))).not.toHaveLength(
      0,
    );
    expect(await validate(convertir({ dependenciaId: '0' }))).not.toHaveLength(
      0,
    );
  });
});
