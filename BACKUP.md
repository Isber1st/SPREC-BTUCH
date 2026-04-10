# Respaldo del proyecto Apps Script

Este proyecto quedó con respaldo local, respaldo en Git y un flujo seguro para trabajar con `clasp`.

## Comandos

Crear un snapshot local del estado actual:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-appscript.ps1
```

Traer lo último desde Apps Script con `clasp` y luego crear snapshot:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pull-and-backup.ps1
```

Crear un respaldo en Git con commit automático:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\git-backup.ps1
```

Traer cambios remotos desde Apps Script con respaldo previo y commit posterior:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\safe-clasp-pull.ps1
```

Subir cambios locales a Apps Script con respaldo previo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\safe-clasp-push.ps1
```

## Dónde quedan los respaldos

Cada ejecución crea una carpeta nueva dentro de:

```text
.\backups\appscript\
```

Ejemplo:

```text
.\backups\appscript\20260410-114500\
```

Dentro se guardan:

- `appsscript.json`
- `server.js`
- `index.html`
- `.clasp.json`
- `.claspignore` si existe
- `manifest.json` con fecha y archivos incluidos

## Flujo recomendado

1. Antes de cambios grandes, ejecutar `backup-appscript.ps1`.
2. Si sospechas que lo remoto tiene cambios más nuevos, ejecutar `safe-clasp-pull.ps1`.
3. Hacer tus cambios locales y probar.
4. Ejecutar `git-backup.ps1` para guardar un punto de recuperación en Git.
5. Ejecutar `git push` para enviarlo a GitHub.
6. Si quieres publicar en Apps Script, ejecutar `safe-clasp-push.ps1`.

## Reglas prácticas

- Evita usar `clasp pull` si tienes cambios locales no revisados.
- Evita usar `clasp push` si no hiciste al menos un respaldo local o commit reciente.
- Usa GitHub como respaldo externo y `backups/` como recuperación rápida local.
- Si cambias algo directo en el editor web de Apps Script, trae esos cambios con `safe-clasp-pull.ps1` antes de seguir trabajando localmente.

## Restauración manual

Si necesitas volver a una copia:

1. Abre la carpeta del respaldo deseado en `.\backups\appscript\`.
2. Copia los archivos de vuelta al directorio raíz del proyecto.
3. Revisa diferencias antes de hacer `clasp push`.

## Restauración con Git

Ver historial:

```powershell
git log --oneline
```

Ver cambios de un commit:

```powershell
git show <commit>
```
