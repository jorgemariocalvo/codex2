# Gestión de solicitudes

## Purpose

Centralizar el registro y seguimiento de las solicitudes de Comercial Aurora con un responsable y un historial por caso.

## ADDED Requirements

### Requirement: Radicación manual
El sistema SHALL permitir radicar solicitudes con cliente identificado por NIT, canal, tipo y descripción de al menos 10 caracteres. El número de pedido SHALL ser opcional. Los catálogos SHALL ofrecer teléfono, correo y mensajería, y los tipos consulta de stock, estado de pedido, inconformidad de envío, facturación o cobro y devolución.

#### Scenario: Radicación válida
- **WHEN** un agente busca por NIT o razón social, selecciona un cliente del directorio y guarda una solicitud válida
- **THEN** el sistema registra el NIT y la razón social, asigna la hora de recepción del servidor, crea el caso como Nuevo y confirma su ticket y responsable.

#### Scenario: Campos inválidos
- **WHEN** un agente intenta guardar sin seleccionar canal o cliente, con un tipo fuera del catálogo o con una descripción demasiado corta
- **THEN** el sistema indica qué corregir y no genera un ticket, asignación ni evento.

### Requirement: Numeración y asignación por turnos
El sistema SHALL generar un identificador único e inmutable con formato AUR-YYYYMM-XXXX y asignar automáticamente cada alta al siguiente agente en una rotación de cuatro. La confirmación SHALL incluir ticket y responsable.

#### Scenario: Radicaciones simultáneas
- **WHEN** ingresan cuatro solicitudes válidas simultáneamente con los cuatro agentes habilitados
- **THEN** se generan cuatro identificadores distintos y cada agente recibe una solicitud sin dejar casos sin responsable.

### Requirement: Bandeja filtrable
El sistema SHALL permitir buscar por ticket, NIT o razón social y filtrar por responsable, estado y vencimiento dentro del alcance autorizado para cada usuario.

#### Scenario: Búsqueda del coordinador
- **WHEN** el coordinador busca un NIT y filtra por responsable y vencimiento
- **THEN** la bandeja muestra solamente las solicitudes que cumplen todos los filtros y permite revisar el historial de cada una.

### Requirement: Seguimiento y cierre
El sistema SHALL manejar los estados Nuevo, En proceso, Pendiente de logística, Pendiente de ventas, Resuelto y Cerrado. Resolver SHALL requerir registrar una respuesta de fondo. Cerrar SHALL requerir que el caso esté resuelto.

#### Scenario: Resolución y cierre
- **WHEN** el responsable registra la respuesta de fondo y resuelve, y luego el coordinador cierra el caso
- **THEN** el sistema muestra el estado Cerrado, la respuesta y los eventos de resolución y cierre en el historial.

#### Scenario: Cierre prematuro
- **WHEN** el coordinador intenta cerrar un caso pendiente de logística
- **THEN** el sistema rechaza la transición y conserva el estado y el historial.

### Requirement: Historial de atención
El sistema SHALL registrar un evento por cada radicación, reasignación y transición exitosa. Cada evento SHALL indicar ticket, usuario, fecha y hora, acción, estados anterior y nuevo cuando correspondan, responsables cuando cambien y comentarios cuando se aporten. Los usuarios SHALL poder consultar los eventos sin editarlos ni eliminarlos.

#### Scenario: Auditoría de un cambio
- **WHEN** el coordinador reasigna un caso y el nuevo responsable lo mueve a En proceso
- **THEN** el historial muestra los dos eventos en orden, con sus actores y los valores anteriores y nuevos correspondientes.

### Requirement: Rendimiento y captura
El piloto SHALL demostrar una radicación válida en menos de 30 segundos y la carga y búsqueda de bandeja en hasta 1,5 segundos en el entorno de aceptación.

#### Scenario: Volumen representativo del piloto
- **WHEN** se mide desde el navegador con 300 clientes ficticios, 600 solicitudes y cinco sesiones activas
- **THEN** la prueba documenta los tiempos frente a ambos límites e identifica cualquier incumplimiento antes de aceptar el piloto.
