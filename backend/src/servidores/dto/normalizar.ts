import { Transform } from 'class-transformer';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const mayusculas = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// Texto en mayúsculas; vacío => null (campos opcionales).
const mayusculasONulo = ({ value }: { value: unknown }): unknown => {
  const texto = mayusculas({ value });
  return texto === '' ? null : texto;
};

export const Recortar = () => Transform(recortar);
export const Mayusculas = () => Transform(mayusculas);
export const MayusculasONulo = () => Transform(mayusculasONulo);
