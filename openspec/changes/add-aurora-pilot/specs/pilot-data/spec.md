# Datos del piloto

## Purpose

Permitir ensayar la operación con clientes ficticios y comprobar la portabilidad y recuperación de los datos compartidos.

## ADDED Requirements

### Requirement: Importación de clientes ficticios
El sistema SHALL permitir al coordinador importar clientes en CSV y JSON, con NIT y razón social obligatorios. SHALL validar el archivo antes de guardar, conservar el NIT como texto e indicar filas o entradas inválidas y duplicadas.

#### Scenario: Directorio válido
- **WHEN** el coordinador importa un archivo válido en cualquiera de los dos formatos y confirma su carga
- **THEN** el directorio compartido muestra los clientes importados y los agentes pueden seleccionarlos al radicar.

#### Scenario: Archivo con errores
- **WHEN** un archivo contiene un NIT duplicado dentro del archivo o en el directorio, o una entrada sin razón social
- **THEN** la aplicación identifica las entradas afectadas y conserva el directorio previo sin cargas parciales.

### Requirement: Exportación de datos del piloto
El sistema SHALL permitir al coordinador descargar un JSON con clientes, solicitudes e historial relacionados. SHALL excluir contraseñas, credenciales y datos de sesión.

#### Scenario: Exportación consultable
- **WHEN** el coordinador exporta los datos tras crear y resolver un ticket
- **THEN** el JSON contiene el cliente, la solicitud resuelta y los eventos correspondientes sin información de autenticación.

### Requirement: Recuperación y protección de datos
El piloto SHALL usar datos ficticios hasta que Comercial Aurora apruebe el tratamiento de datos, los accesos y la prueba de recuperación. SHALL mantener copias de seguridad protegidas para restaurar solicitudes, clientes, historial y asignaciones.

#### Scenario: Restauración aislada
- **WHEN** se restaura una copia del piloto en un entorno de prueba aislado
- **THEN** se recuperan los clientes, tickets, responsables, estados e historial de la copia y el servicio puede consultarlos desde el navegador.
