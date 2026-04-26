# Remote Access With Cloudflare SSH

## Objetivo

Permitir acceso SSH al host Linux nativo desde cualquier red sin exponer el puerto 22 del router.

## Solución adoptada

- Cloudflare Tunnel en el host
- Cloudflare Access protegiendo `ssh.kevbeaoca.uk`
- cliente `cloudflared` en el PC de trabajo
- alias SSH local `docker-server-remote`

## Configuración del servidor

En `/etc/cloudflared/config.yml` se añadió:

```yml
- hostname: ssh.kevbeaoca.uk
  service: ssh://localhost:22
```

Después se reinició:

```bash
sudo systemctl restart cloudflared
```

## Configuración del cliente Windows

Archivo:

```text
C:\Users\kevin\.ssh\config
```

Contenido:

```sshconfig
Host docker-server-remote
  HostName ssh.kevbeaoca.uk
  User kevin
  ProxyCommand cloudflared access ssh --hostname %h
```

## Flujo de uso

```powershell
ssh docker-server-remote
```

Cloudflare Access abre autenticación web y, una vez validado, la conexión entra al host.

## Observaciones

- funciona también fuera de la red local
- no requiere abrir puertos en router
- deja resuelto el trabajo remoto del proyecto
