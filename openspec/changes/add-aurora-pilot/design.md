# Diseño del piloto A05

## Context

El repositorio contiene OpenSpec y sus herramientas. Este cambio define la primera aplicación. El alcance acordado exige cinco sesiones concurrentes, una base compartida y pruebas con datos ficticios. El documento de referencia aporta el modelo de solicitudes, los objetivos y la hoja de ruta.

## Goals / Non-Goals

- Servir la interfaz y la API desde un origen HTTPS para simplificar el acceso desde el navegador y la gestión de sesiones.
- Asegurar la consistencia de las radicaciones, asignaciones e historial con transacciones.
- Mantener las integraciones externas para los horizontes posteriores según la propuesta.

## Decisions

1. **Aplicación web y almacenamiento.** Node.js servirá HTML, CSS, JavaScript y una API JSON del mismo origen. PostgreSQL guardará usuarios, clientes, solicitudes, eventos y contadores. Los arreglos en el navegador servirán para presentar datos de la sesión. Una entrega mediante archivo HTML local no permite compartir de forma fiable la misma base de datos y las mismas sesiones.
2. **Roles y sesiones.** Aprovisionar las cinco cuentas en el entorno piloto. Usar hash de contraseñas, cookies de sesión seguras y autorización del lado del servidor. El coordinador podrá importar, exportar, reasignar y cerrar. El agente asignado podrá actualizar y resolver su caso. Las pruebas verificarán los permisos desde la interfaz y la API. Las credenciales de prueba se entregarán por un canal privado.
3. **Transacciones e historial.** Usar restricciones de unicidad en NIT y ticket, y claves foráneas para usuarios y clientes. Serializar por transacción el consecutivo mensual y el avance de la rotación. Confirmar solicitud, responsable e historial en la misma transacción. Bloquear la fila o comprobar su versión al modificarla para evitar sobrescribir cambios concurrentes. La aplicación permitirá agregar y consultar eventos con permisos restringidos.
4. **Calendario y alertas.** Guardar instantes en UTC y derivar el mes del ticket y la presentación con la zona `America/Bogota`. Reiniciar el consecutivo al cambiar ese mes. Calcular el plazo con la hora del servidor y actualizar los niveles al abrir o refrescar la bandeja. Una actualización periódica en la vista permite mostrar alertas visuales durante el uso sin un servicio separado de notificaciones.
5. **Datos de prueba y restauración.** Validar y mostrar un resumen antes de confirmar la importación en una transacción. Proveer 300 clientes y 600 solicitudes ficticias, con casos cerca de los umbrales del plazo. Usar JSON para intercambio y copias de la base para recuperación. Probar la restauración en una base aislada.

## Risks / Trade-offs

- **Ediciones concurrentes.** Si una transición usa una versión obsoleta del ticket, informar al usuario y recargar el caso antes de reintentar.
- **Consecutivo mensual limitado.** El formato admite cuatro dígitos y el volumen previsto de 600 solicitudes mensuales cabe en el rango. Detectar agotamiento y rechazar el alta con un mensaje explícito para conservar unicidad.
- **Costos del entorno.** Comparar opciones de alojamiento HTTPS y PostgreSQL con los topes aprobados, incluyendo copias de seguridad. Registrar la estimación antes de provisionar infraestructura facturable.

## Migration Plan

Aplicar las migraciones a una base dedicada, cargar los datos ficticios, provisionar las cuentas de prueba y desplegar detrás de HTTPS. Validar la operación desde navegadores independientes. Antes de actualizar, tomar una copia y comprobar que puede restaurarse. Ante un fallo, recuperar el despliegue anterior y restaurar la base cuando la migración lo requiera. La decisión de usar datos reales se tomará al finalizar el piloto.
