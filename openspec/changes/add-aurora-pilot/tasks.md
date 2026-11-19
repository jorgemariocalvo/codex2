# Tareas del piloto A05

## 1. Semana 1 · Entorno y base de datos

- [ ] 1.1 Configurar Node.js y PostgreSQL y documentar el arranque local. Verificar que una instalación limpia levanta la aplicación y conecta con la base.
- [ ] 1.2 Crear las migraciones para cuentas, clientes, tickets, eventos y contadores. Verificar claves, unicidad y relaciones en una base vacía.
- [ ] 1.3 Preparar una estimación de implementación y alojamiento HTTPS con copias de seguridad. Comparar los montos con los límites de COP 12.000.000 iniciales y COP 300.000 mensuales.

## 2. Semana 2 · Acceso, clientes y formulario

- [ ] 2.1 Implementar inicio y cierre de sesión y permisos por rol. Probar cinco cuentas independientes y solicitudes sin sesión o fuera del permiso de cada usuario.
- [ ] 2.2 Implementar la importación autorizada CSV y JSON con validación y confirmación. Probar ambos formatos, NIT como texto y rechazo completo de archivos inválidos o duplicados.
- [ ] 2.3 Construir un formulario adaptable con búsqueda por NIT o razón social, listas cerradas y pedido opcional. Probar el envío válido y los mensajes de campos inválidos.

## 3. Semana 3 · Radicación y seguimiento

- [ ] 3.1 Guardar ticket, fecha de recepción, asignación y evento en una transacción. Probar cuatro altas simultáneas, cambio de mes en Colombia y rechazo sin efectos ante un alta inválida.
- [ ] 3.2 Crear bandeja y vista de detalle con filtros combinados. Probar visibilidad global del coordinador y acceso del agente limitado a sus casos, incluso por URL directa.
- [ ] 3.3 Implementar reasignación, cambios de estado, respuesta de fondo e historial. Probar reasignación, cierre de un caso resuelto, rechazo de cierre prematuro y manejo de una edición concurrente.

## 4. Semana 4 · Plazos y exportación

- [ ] 4.1 Calcular los plazos y representar alertas visuales en la bandeja. Probar los límites de 24, 36 y 48 horas, así como el conteo continuo en fines de semana y estados pendientes.
- [ ] 4.2 Registrar el tiempo y el cumplimiento al resolver y mostrar el indicador del coordinador. Probar resolución exacta a las 48 horas, resolución posterior y conservación del resultado al cerrar.
- [ ] 4.3 Exportar clientes, solicitudes e historial en JSON con permiso de coordinador. Verificar la relación entre registros y la ausencia de credenciales y datos de sesión.

## 5. Semana 5 · Integración y recuperación

- [ ] 5.1 Preparar 300 clientes y 600 solicitudes ficticias de prueba. Verificar cantidades, relaciones y presencia de casos en cada nivel de alerta.
- [ ] 5.2 Ejecutar la prueba integral con cinco sesiones. Registrar el tiempo de radicación frente al límite de 30 segundos y el de carga y búsqueda de bandeja frente al límite de 1,5 segundos.
- [ ] 5.3 Documentar y ejecutar la copia de seguridad y la restauración aislada. Verificar desde el navegador los clientes, tickets, responsables e historial recuperados.

## 6. Semana 6 · Entrega y aceptación

- [ ] 6.1 Desplegar el piloto mediante HTTPS y entregar la URL y las cuentas de prueba por un canal privado. Verificar que los cinco participantes pueden entrar desde sus navegadores.
- [ ] 6.2 Completar la aceptación con la radicación, reasignación, resolución, alertas y exportación. Registrar resultados y repetir las pruebas afectadas por las correcciones.
- [ ] 6.3 Documentar el resultado del piloto y las condiciones de aprobación para la incorporación de datos reales. Verificar que el entorno de prueba contiene únicamente datos ficticios.

## Workflow follow-up

- Archivar el cambio en OpenSpec después de la implementación y la aceptación.
