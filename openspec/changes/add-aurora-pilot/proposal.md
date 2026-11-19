# Piloto compartido de atención al cliente de Comercial Aurora

## Why

Comercial Aurora atiende a 300 clientes, tramita 1.200 pedidos y recibe unas 600 solicitudes al mes. Según la línea base aportada, pierde el 10 % de las solicitudes y deja el 30 % sin asignación, lo que afecta el seguimiento y la confiabilidad del servicio.

## What Changes

- Entregar en seis semanas una aplicación web compartida por cuatro agentes y un coordinador, accesible mediante HTTPS y probada inicialmente con datos ficticios.
- Unificar la radicación manual, asignar los casos por turnos y habilitar la búsqueda, el seguimiento y el historial.
- Incorporar al piloto el plazo de 48 horas corridas y las alertas visuales a las 24 y 36 horas.
- Importar clientes de prueba desde CSV y JSON y exportar los datos del piloto en JSON.
- Reservar para H2 la ingesta automática, la consulta al ERP y las notificaciones por correo o push. Reservar para H3 el portal de clientes, la analítica y la sincronización bidireccional con el ERP.

## Capabilities

### New Capabilities

- `pilot-access` — Acceso individual, permisos y operación compartida en navegador.
- `request-management` — Radicación, asignación, bandeja, estados e historial.
- `service-deadlines` — Plazo de atención, alertas visuales y medición del cumplimiento.
- `pilot-data` — Importación, exportación y recuperación de datos de prueba.

### Modified Capabilities

## Impact

Interfaz HTML5, CSS3 y JavaScript, servidor Node.js y base PostgreSQL. La implementación inicial tiene un tope de COP 12.000.000 y la infraestructura y licencias de COP 300.000 mensuales. Con datos reales, los objetivos operativos son registrar y asignar el 100 % de los casos, resolver al menos el 90 % en 48 horas corridas, reducir la gestión de 20 a 12 minutos por caso y bajar los sobrecostos mensuales de COP 800.000 a COP 400.000. El piloto preparará la medición con datos ficticios.
