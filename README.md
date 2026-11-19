# Comercial Aurora · Gestión de solicitudes

Piloto A05 con cuatro agentes, un coordinador y una base PostgreSQL compartida. La interfaz HTML, CSS y JavaScript se sirve junto con la API Node.js.

## Probar en el navegador

1. Instala Node.js 22.20 o posterior y ejecuta `npm ci`.
2. Ejecuta `npm run demo`. La primera ejecución inicializa PostgreSQL local y carga 300 clientes y 600 solicitudes ficticias.
3. Abre `http://127.0.0.1:3000` en un navegador de la misma máquina. Los usuarios son `agente1` a `agente4` y `coordinador`. Cada contraseña se genera al iniciar por primera vez y queda en el archivo privado `.aurora/credentials.json`, bajo `accounts`. Usa perfiles o ventanas privadas independientes para probar sesiones simultáneas.

La demostración guarda cambios al reiniciar. Para usar otra base de demostración, define `AURORA_DEMO_DIR` y, si se ejecutan instancias simultáneas, configura puertos distintos con `PORT` y `PG_DEMO_PORT`. Detén el proceso con Ctrl+C.

Como agente, radica una solicitud eligiendo un cliente, un canal y un tipo. La confirmación muestra el ticket y el responsable. Como coordinador, busca ese ticket y abre su historial. Puedes reasignarlo, cerrarlo tras la resolución o filtrar la bandeja por plazo. Los casos de prueba incluyen avisos preventivos, urgentes y vencidos.

Para importar, el coordinador selecciona **Datos del piloto**, carga el archivo, revisa la validación y confirma. CSV usa la cabecera `nit,razon_social`. JSON usa un arreglo como `[{"nit":"000321","razon_social":"Colegio ficticio de ejemplo"}]`. Desde el mismo panel se puede descargar un JSON de clientes, solicitudes e historial.

## Desplegar el piloto compartido

- Prepara una base PostgreSQL dedicada y un origen HTTPS para la aplicación. El proceso requiere `DATABASE_URL`; provisiona cuentas mediante `npm run provision -- /ruta/privada/cuentas.json`. El JSON es un objeto con las claves `agente1`, `agente2`, `agente3`, `agente4` y `coordinador`, y una contraseña distinta de al menos 12 caracteres para cada una. Comparte las credenciales por un canal privado.
- Configura `AURORA_ORIGIN` con el origen HTTPS público, sin barra final, y ejecuta `npm start`. Configura el proxy HTTPS para enviar las solicitudes a `PORT` (3000 por defecto). Si corre en la misma máquina, indica `HOST=127.0.0.1` y limita el acceso directo al proceso. La sesión usa cookies seguras.
- Aprovisiona los secretos fuera del repositorio. Usa copias de seguridad cifradas con acceso restringido. Mantén el entorno del piloto con datos ficticios hasta aprobar accesos, tratamiento de datos y recuperación.

## Pruebas y recuperación

`npm test` ejecuta pruebas contra una base PostgreSQL aislada y Chromium. En un entorno con otra ubicación del ejecutable, define `CHROMIUM_PATH`. Las pruebas verifican concurrencia, permisos, límites de plazo, importación y exportación, cinco sesiones del navegador y restauración.

Para una base administrada, usa sus copias de seguridad o una copia lógica con `pg_dump --format=custom --file=aurora.dump "$DATABASE_URL"` y restaura en una base aislada y vacía con `pg_restore --exit-on-error --no-owner --dbname="$RESTORE_DATABASE_URL" aurora.dump`. Restringe los permisos sobre el archivo y conserva las copias en almacenamiento cifrado. Arranca la aplicación contra la base restaurada y verifica clientes, responsables y eventos desde el navegador. Para la demostración local, también funciona una copia física del directorio de PostgreSQL después de detenerlo limpiamente, restaurada con la misma versión de PostgreSQL. La suite automatiza esa segunda modalidad.

## Presupuesto de planificación

Estimación inicial sujeta a cotización. El supuesto de trabajo es de 140 horas a COP 75.000 por hora, para COP 10.500.000 de implementación. Quedan COP 1.500.000 de margen frente al tope de COP 12.000.000. Para infraestructura mensual, se estima un máximo de COP 130.000 para aplicación y HTTPS, COP 120.000 para PostgreSQL y COP 30.000 para copias, para un total de COP 280.000 frente al tope de COP 300.000. Los importes son asignaciones de presupuesto y requieren confirmar oferta, impuestos y condiciones de servicio antes de contratar.

La aceptación formal requiere que el equipo pruebe el flujo en el origen HTTPS asignado y registre los tiempos de uso y hallazgos. Los tiempos de la suite automatizada sirven como referencia técnica preliminar.

## Resultado técnico del piloto

En una instalación limpia, las cuatro pruebas automatizadas pasaron dos veces. En la segunda ejecución, Chromium midió 54 ms para actualizar la bandeja, 308 ms para buscar el ticket y 397 ms para completar una radicación automatizada. Se usaron cinco sesiones independientes y una base con 300 clientes y 600 casos ficticios iniciales. Se verificaron la recuperación en otra instancia de PostgreSQL y los flujos de reasignación, resolución, cierre y descarga. La medición de radicación con participantes y la aceptación en un origen HTTPS compartido están pendientes.

### Validación previa al despliegue

Se verificaron localmente cinco inicios de sesión concurrentes sobre HTTPS con un certificado de prueba de confianza explícita. Las cinco cuentas recibieron cookies con los atributos Secure e HttpOnly, consultaron su bandeja y cerraron sesión. La suite en Chromium volvió a pasar con 69 ms para actualizar la bandeja, 308 ms para buscar el ticket y 380 ms para la radicación automatizada.

Para la aceptación en el alojamiento compartido, registra la fecha, el entorno, el rol, el tiempo observado y el resultado de cada uno de estos pasos con datos ficticios:

1. Los cuatro agentes y el coordinador acceden a la URL HTTPS en sesiones independientes.
2. Un agente radica una solicitud y el coordinador confirma que aparece en su bandeja. Registra el tiempo de radicación manual y el de búsqueda.
3. El coordinador reasigna el ticket y el nuevo responsable lo resuelve con una respuesta de fondo. El coordinador lo cierra y revisa el historial.
4. El coordinador comprueba las etiquetas de aviso preventivo, urgente y vencido en los casos de prueba, y descarga la exportación JSON.
5. El equipo registra los hallazgos y repite los escenarios afectados por cada corrección.
