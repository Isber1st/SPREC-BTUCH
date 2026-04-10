# Respaldo del proyecto Apps Script

Este proyecto quedó con un respaldo local simple para no perder el código si algo falla.

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
2. Si sospechas que lo remoto tiene cambios más nuevos, ejecutar `pull-and-backup.ps1`.
3. Después de un cambio estable, ejecutar `git-backup.ps1` para guardar un punto de recuperación en Git.

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
