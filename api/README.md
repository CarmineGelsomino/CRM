# CRM API Backend

Endpoint principale: `api/index.php`

## CRUD generico per tutte le entità

- **List**: `GET /api/index.php?entity=contacts`
- **Get by id**: `GET /api/index.php?entity=contacts&id=10`
- **Create**: `POST /api/index.php?entity=contacts`
- **Update**: `PUT /api/index.php?entity=contacts&id=10`
- **Delete**: `DELETE /api/index.php?entity=contacts&id=10`

Body JSON per `POST/PUT/PATCH`: passa i campi ammessi della tabella.

## Funzioni custom

### 1) Contatti non contattati da X giorni

`GET /api/index.php?entity=contacts&action=inactive&days=30&user_id=1`

Parametri:
- `days` (opzionale, default 30)
- `user_id` (opzionale)

### 2) Reset password utente

`POST /api/index.php?entity=users&action=reset-password`

Body JSON:

```json
{
  "user_id": 1,
  "new_password": "NuovaPassword123!"
}
```

Oppure con email:

```json
{
  "email": "demo1@example.com"
}
```

Se `new_password` manca, viene generata automaticamente.

## Config DB

File: `api/src/Config/database.php`

Puoi sovrascrivere i valori con env:
- `CRM_DB_HOST`
- `CRM_DB_PORT`
- `CRM_DB_NAME`
- `CRM_DB_USER`
- `CRM_DB_PASSWORD`
