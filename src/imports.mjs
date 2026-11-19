import { parse } from 'csv-parse/sync';
import { HttpError } from './tickets.mjs';
import { transaction } from './db.mjs';

function decode(format, content) {
  if (typeof content !== 'string') throw new HttpError(400, 'Selecciona un archivo.');
  try {
    const source = content.replace(/^\uFEFF/, '');
    if (format === 'csv') {
      return parse(source, {
        columns: (headers) => {
          const names = headers.map((name) => name.trim().toLowerCase());
          if (!names.includes('nit') || !names.some((name) => name === 'name' || name === 'razon_social') ||
              new Set(names).size !== names.length) throw new Error('Cabeceras inválidas');
          return names;
        },
        skip_empty_lines: true, trim: true, info: true
      }).map(({record, info}) => ({ record, line: info.lines }));
    }
    if (format === 'json') {
      const records = JSON.parse(source);
      if (!Array.isArray(records)) throw new Error('Se esperaba un arreglo');
      return records.map((record, index) => ({ record, line: index + 1 }));
    }
  } catch (error) {
    const location = error.lines ? ' en la línea ' + error.lines : '';
    throw new HttpError(400, 'Archivo ' + format.toUpperCase() + ' inválido' + location + '. Revisa el formato y sus campos.');
  }
  throw new HttpError(400, 'Usa un archivo CSV o JSON.');
}

async function validate(db, format, content) {
  const raw = decode(format, content);
  if (!raw.length) throw new HttpError(400, 'El archivo no contiene clientes.');
  const rows = raw.map(({record, line}) => ({
    line, nit: typeof record?.nit === 'string' ? record.nit.trim() : '',
    name: typeof (record?.razon_social ?? record?.name) === 'string' ? (record.razon_social ?? record.name).trim() : ''
  }));
  const frequencies = new Map();
  for (const { nit } of rows) frequencies.set(nit, (frequencies.get(nit) ?? 0) + 1);
  const { rows: previous } = await db.query('SELECT nit FROM clients WHERE nit=ANY($1)', [[...frequencies.keys()]]);
  const known = new Set(previous.map(({nit}) => nit));
  const errors = rows.flatMap(({line, nit, name}) => {
    const problems = [];
    if (!nit || !name) problems.push('NIT de texto y razón social son obligatorios.');
    if (nit && frequencies.get(nit) > 1) problems.push('NIT duplicado en el archivo.');
    if (known.has(nit)) problems.push('El NIT ya existe en el directorio.');
    return problems.map((message) => ({ line, message }));
  });
  return { rows, errors };
}

export async function importClients(pool, { format, content, confirm }) {
  return transaction(pool, async (db) => {
    if (confirm === true) await db.query('LOCK TABLE clients IN SHARE ROW EXCLUSIVE MODE');
    const { rows, errors } = await validate(db, format, content);
    if (confirm === true && errors.length === 0) {
      await db.query('INSERT INTO clients SELECT * FROM unnest($1::text[], $2::text[])',
        [rows.map(({nit}) => nit), rows.map(({name}) => name)]);
    }
    return { count: rows.length, errors, imported: confirm === true && errors.length === 0 };
  });
}
