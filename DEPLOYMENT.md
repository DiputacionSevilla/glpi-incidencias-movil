# Despliegue en Ubuntu con Docker Compose

Este despliegue ejecuta la aplicacion, Redis y Caddy. Solo Caddy queda accesible desde la red en el puerto `80`; el proxy HTTPS corporativo situado delante del servidor termina TLS y reenvia las solicitudes a Caddy.

## Requisitos previos

- Ubuntu 22.04 LTS o posterior, con acceso saliente a Internet para descargar imagenes.
- Un nombre DNS, por ejemplo `incidencias.example.internal`, con registros `A` y/o `AAAA` que apunten al proxy HTTPS corporativo.
- El proxy HTTPS corporativo debe reenviar el puerto TCP `80` al servidor y preservar el encabezado `Host`.
- Conectividad HTTPS desde el servidor a `GLPI_BASE_URL`.
- Docker Engine y el complemento Docker Compose instalados.

Instalar Docker desde el repositorio oficial de Docker para Ubuntu y comprobar la instalacion:

```sh
docker --version
docker compose version
```

Permitir los puertos web si UFW esta activo:

```sh
sudo ufw allow 80/tcp
```

## Preparacion

Copiar el codigo al servidor, preferiblemente bajo `/opt`, y limitar el acceso al usuario administrador del servicio:

```sh
sudo mkdir -p /opt/glpi-incidencias-movil
sudo chown "$USER":"$USER" /opt/glpi-incidencias-movil
git clone <URL_DEL_REPOSITORIO> /opt/glpi-incidencias-movil
cd /opt/glpi-incidencias-movil
cp .env.example .env
chmod 600 .env
```

Editar `.env`. Estos valores son obligatorios:

```dotenv
GLPI_BASE_URL=https://glpi.example.internal/glpi
GLPI_APP_TOKEN=<token-de-aplicacion-de-glpi>
SESSION_SECRET=<secreto-aleatorio-de-al-menos-32-caracteres>
APP_ORIGIN=https://incidencias.example.internal
```

Generar un secreto de sesion adecuado sin mostrarlo en el historial de la terminal:

```sh
openssl rand -base64 48
```

`APP_ORIGIN` debe coincidir exactamente con la URL publica, incluido `https`. Mantener `GLPI_ALLOW_HTTP=false` salvo que GLPI sea una instalacion HTTP interna y exista una autorizacion explicita para ello.

## Inicio y comprobacion

Construir e iniciar los servicios:

```sh
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs -f proxy
```

Comprobar la aplicacion desde el propio servidor:

```sh
curl --fail https://incidencias.example.internal/api/health/live
curl --fail https://incidencias.example.internal/api/health/ready
```

`live` verifica que el proceso responde. `ready` tambien verifica Redis y la conectividad con GLPI. No exponer ni acceder directamente a los puertos de la aplicacion o Redis: no se publican en el host.

## Actualizacion y rollback

Antes de actualizar, revisar los cambios de configuracion y crear una copia protegida del fichero de entorno:

```sh
cp .env .env.backup
git pull --ff-only
docker compose build --pull
docker compose up -d --remove-orphans
docker compose ps
```

Para volver a una revision anterior, sustituir `<revision-anterior>` por un tag o commit ya validado y recrear los servicios:

```sh
git checkout <revision-anterior>
docker compose build --pull
docker compose up -d --remove-orphans
```

Redis almacena sesiones en memoria: reiniciar o recrear ese contenedor invalida las sesiones activas, sin afectar a los datos de GLPI.

## Operacion

Consultar estado y registros:

```sh
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 proxy
docker compose logs --tail=100 redis
```

Renovar `SESSION_SECRET` invalida todas las sesiones. Al rotar `GLPI_APP_TOKEN`, actualizar `.env` y ejecutar `docker compose up -d` para recrear la aplicacion. Guardar `.env` en un gestor de secretos o en copias de seguridad cifradas; contiene credenciales operativas.
