# Plazos de atención

## Purpose

Ayudar al equipo a priorizar casos pendientes y medir el cumplimiento del plazo de atención de Comercial Aurora.

## ADDED Requirements

### Requirement: Plazo continuo
El sistema SHALL calcular el vencimiento sumando 48 horas corridas a la recepción registrada por el servidor. Los estados pendientes y los fines de semana SHALL contar para el plazo.

#### Scenario: Recepción antes del fin de semana
- **WHEN** se registra una solicitud el viernes a las 16:00 en Colombia y se deja pendiente de logística
- **THEN** la bandeja muestra como vencimiento el domingo a las 16:00 en Colombia.

### Requirement: Alertas visuales de casos abiertos
El sistema SHALL presentar el nivel vigente en la bandeja del coordinador y del agente asignado. Antes de 24 horas el caso estará en plazo, desde 24 horas y antes de 36 horas tendrá aviso preventivo, desde 36 hasta 48 horas inclusive tendrá aviso urgente, y después de 48 horas aparecerá vencido.

#### Scenario: Cruce de umbrales
- **WHEN** la bandeja abierta se actualiza con casos sin resolver de 23 h 59 min, 24 h, 36 h, 48 h y 48 h 1 min
- **THEN** los casos aparecen, respectivamente, en plazo, preventivo, urgente, urgente y vencido, con etiquetas legibles además del color.

#### Scenario: Resolución detiene la alerta activa
- **WHEN** el responsable resuelve un caso que tenía una alerta vigente
- **THEN** el caso sale de las alertas activas y conserva su resultado histórico de cumplimiento.

### Requirement: Medición al resolver
El sistema SHALL guardar la fecha de resolución, la duración en horas corridas y el resultado del plazo. SHALL determinar el cumplimiento sin redondear la duración y mostrar al coordinador la proporción de solicitudes resueltas dentro del plazo, incluidas las cerradas que ya fueron resueltas.

#### Scenario: Resolución en el límite
- **WHEN** un agente resuelve un caso exactamente a las 48 h y otro a las 48 h y un segundo
- **THEN** el primer caso figura como cumplido, el segundo como incumplido y ambos se cuentan una sola vez en el indicador, incluso después del cierre.
