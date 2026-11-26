import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarServidorDto } from './actualizar-servidor.dto';

const base = {
  nombre: 'ana',
  primerApellido: 'lopez',
  segundoApellido: '',
  rfc: 'lopa010101',
  homoclave: 'ab1',
  curp: 'lopa010101mmcpna09',
  cargo: 'analista',
  nivelCargo: '25-1',
  tipoDependenciaId: '3',
  honorarios: '2',
};

const convertir = (extra: Record<string, unknown> = {}) =>
  plainToInstance(ActualizarServidorDto, { ...base, ...extra });

describe('ActualizarServidorDto', () => {
  it('pasa a mayúsculas nombre, apellidos, RFC, homoclave y CURP', async () => {
    const dto = convertir();
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: null,
      rfc: 'LOPA010101',
      homoclave: 'AB1',
      curp: 'LOPA010101MMCPNA09',
      tipoDependenciaId: 3,
    });
  });

  it('el motivo es opcional pero, si viene, no puede ir vacío ni ser muy corto', async () => {
    expect(await validate(convertir({ motivo: 'CORRECCION' }))).toHaveLength(0);
    expect(await validate(convertir({ motivo: '   ' }))).not.toHaveLength(0);
    expect(await validate(convertir({ motivo: 'abc' }))).not.toHaveLength(0);
    expect(
      await validate(convertir({ motivo: 'x'.repeat(501) })),
    ).not.toHaveLength(0);
  });

  it('valida el formato del correo', async () => {
    expect(
      await validate(convertir({ email: 'no-es-correo' })),
    ).not.toHaveLength(0);
    expect(await validate(convertir({ email: 'a@b.com' }))).toHaveLength(0);
  });
});
