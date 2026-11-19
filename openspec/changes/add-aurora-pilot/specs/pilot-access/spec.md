# Acceso al piloto

## Purpose

Permitir que el equipo de atención trabaje sobre los mismos casos desde su navegador con cuentas individuales y permisos por rol.

## ADDED Requirements

### Requirement: Acceso web individual
El sistema SHALL ofrecer una interfaz adaptable mediante HTTPS con cuatro cuentas de agente y una de coordinador, utilizables simultáneamente.

#### Scenario: Cinco sesiones concurrentes
- **WHEN** los cinco usuarios inician sesión desde navegadores independientes y un agente registra un caso
- **THEN** el coordinador puede consultarlo en la bandeja compartida al actualizarla y puede volver a consultarlo después de cerrar sesión y volver a ingresar.

#### Scenario: Solicitud sin sesión
- **WHEN** una persona sin sesión válida intenta consultar o modificar un ticket
- **THEN** el servidor deniega la operación y no entrega información del ticket.

### Requirement: Permisos sobre solicitudes
El sistema SHALL dejar que cualquier agente radique casos, consulte y gestione sus casos asignados, y que el coordinador consulte todos los casos, cambie responsables y cierre solicitudes resueltas. El servidor SHALL verificar los permisos para cada operación, incluso cuando se solicita directamente por identificador.

#### Scenario: Acceso a un caso ajeno
- **WHEN** un agente intenta leer o cambiar el estado de un ticket asignado a otro agente, incluso mediante su URL directa
- **THEN** el servidor deniega el acceso y el ticket conserva sus datos e historial.

#### Scenario: Reasignación por el coordinador
- **WHEN** el coordinador reasigna un caso abierto a otro de los cuatro agentes
- **THEN** la bandeja del nuevo responsable muestra el caso y el responsable anterior pierde el acceso.
