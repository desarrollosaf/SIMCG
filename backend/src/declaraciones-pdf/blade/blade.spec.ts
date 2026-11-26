import { readFileSync } from 'fs';
import * as path from 'path';
import { compilarBlade, renderizarNodos } from './blade';
import { Coleccion, Modelo } from './valores';
import { compararPhp, igualPhp, parsearExpresion } from './php';

const render = (
  fuente: string,
  vars: Record<string, unknown> = {},
  sesion = {},
) =>
  renderizarNodos(compilarBlade(fuente), {
    vars: { ...vars },
    sesion,
  });

describe('motor Blade', () => {
  it('escapa {{ }} y deja crudo {!! !!}', () => {
    expect(render(`{{ $a }}|{!! $a !!}`, { a: `<b>"x" & 'y'</b>` })).toBe(
      '&lt;b&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/b&gt;|<b>"x" & \'y\'</b>',
    );
  });

  it('ignora comentarios {{-- --}} y deja @ dentro de palabras', () => {
    expect(render('a{{-- @if(1) --}}b Decl@ra Legis')).toBe('ab Decl@ra Legis');
  });

  it('@if/@elseif/@else (también en mayúsculas) y expresiones con ||', () => {
    const f = '@if($t == 1 || $t == 2) I @elseif($t == 3) II @ELSE III @endif';
    expect(render(f, { t: 2 })).toBe(' I ');
    expect(render(f, { t: 3 })).toBe(' II ');
    expect(render(f, { t: 4 })).toBe(' III ');
  });

  it('@foreach con clave y valor y @php asignando una variable', () => {
    const f =
      '@foreach ($a as $k => $v)[{{$k}}={{$v}}]@endforeach @php($z = "N")@if($z == "N") ok @endif';
    expect(render(f, { a: { uno: 1, dos: null } })).toBe('[uno=1][dos=]  ok ');
    expect(
      render('@foreach($c as $i){{$i}}@endforeach', {
        c: new Coleccion(...[1, 2, 3]),
      }),
    ).toBe('123');
  });

  it('funciones PHP: str_pad, number_format, mb_strtoupper, count, session, empty', () => {
    const f =
      '{{ str_pad($id, 10, "0", STR_PAD_LEFT) }} ${{ number_format($m, 2) }} {{ mb_strtoupper($n) }} {{ count($l) }} @if(!session("intereses")) P @endif @if(empty($x->y->z)) V @endif';
    expect(
      render(
        f,
        {
          id: 42,
          m: '1234567.456',
          n: 'cuernavaca ñ',
          l: new Coleccion(1, 2),
          x: null,
        },
        { intereses: false },
      ),
    ).toBe('0000000042 $1,234,567.46 CUERNAVACA Ñ 2  P   V ');
  });

  it('Carbon::create(...)->format y ternario', () => {
    expect(
      render(
        '{{ \\Carbon\\Carbon::create($f)->format("d-m-Y") }} {{ $e ? "si" : "ENTREGA PENDIENTE" }}',
        { f: '2024-03-09', e: null },
      ),
    ).toBe('09-03-2024 ENTREGA PENDIENTE');
  });

  it('lee atributos de modelos primero y luego relaciones sin distinguir mayúsculas', () => {
    const hijo = new Modelo('Cat', { valor: 'X' });
    const m = new Modelo('Bien', { tipo: 'col' });
    m.relaciones.set('tipoinmueble', hijo);
    m.relaciones.set('tipo', hijo);
    expect(
      render('{{$m->tipoInmueble->valor}}|{{$m->tipo}}|{{$m->nada->valor}}', {
        m,
      }),
    ).toBe('X|col|');
  });

  it('una colección vacía es verdadera como objeto en PHP (pero count es 0)', () => {
    expect(
      render('@if($c) T @else F @endif @if(count($c)) T @else F @endif', {
        c: new Coleccion(),
      }),
    ).toBe(' T   F ');
  });

  it('comparaciones PHP 8 entre cadena y número', () => {
    expect(igualPhp('1', 1)).toBe(true);
    expect(igualPhp(null, 0)).toBe(true);
    expect(igualPhp(null, '')).toBe(true);
    expect(igualPhp('abc', 0)).toBe(false);
    expect(compararPhp('N/', 25)).toBeGreaterThan(0);
    expect(compararPhp('', 25)).toBeLessThan(0);
    expect(compararPhp('08', 25)).toBeLessThan(0);
  });

  it('rechaza PHP que no soporta en lugar de ignorarlo', () => {
    expect(() => parsearExpresion('$a ?? 1')).toThrow();
  });

  describe.each(['index', 'indexc', 'indexp', 'indexcp'])(
    'vista %s',
    (vista) => {
      it('compila completa con el subconjunto soportado', () => {
        const fuente = readFileSync(
          path.join(
            __dirname,
            '..',
            '..',
            'plantillas',
            'declaracion',
            `${vista}.blade.html`,
          ),
          'utf8',
        );
        expect(compilarBlade(fuente).length).toBeGreaterThan(10);
      });
    },
  );
});
