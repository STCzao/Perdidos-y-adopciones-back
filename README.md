# 🐾 Pet Adoption Backend

Backend API REST para la plataforma **Perdidos y Adopciones** - Sistema integral de gestión de mascotas perdidas, encontradas y en adopción.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1.0-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.18+-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Endpoints](#-api-endpoints)
- [Modelos de Datos](#-modelos-de-datos)
- [Autenticación](#-autenticación)
- [Variables de Entorno](#-variables-de-entorno)
- [Scripts Disponibles](#-scripts-disponibles)
- [Despliegue](#-despliegue)
- [Autor](#-autor)

---

## ✨ Características

- 🔐 **Autenticación JWT** con tokens de 4 horas
- 👥 **Sistema de roles** (Admin/Usuario)
- 📝 **CRUD completo** de publicaciones de mascotas
- 🔍 **Búsqueda y filtrado** avanzado con paginación
- 🐕 **Tres tipos de publicaciones:**
  - Mascotas Perdidas
  - Mascotas Encontradas
  - Mascotas en Adopción
- 📧 **Recuperación de contraseña** vía email
- 🌐 **Sistema de comunidad** para historias y alertas
- 📱 **CORS configurado** para frontend específico
- ✅ **Validaciones robustas** en todos los endpoints
- 🖼️ **Integración con Cloudinary** para imágenes
- 📊 **Paginación optimizada** con índices de MongoDB

---

## 🚀 Tecnologías

### Backend
- **Node.js** - Entorno de ejecución
- **Express 5.1.0** - Framework web
- **Mongoose 8.18.1** - ODM para MongoDB

### Seguridad
- **bcryptjs** - Hash de contraseñas
- **jsonwebtoken** - Autenticación JWT
- **express-validator** - Validación de datos
- **cors** - Control de acceso entre orígenes

### Comunicaciones
- **Resend** - Servicio de envío de emails

### Desarrollo
- **nodemon** - Hot reload en desarrollo
- **dotenv** - Gestión de variables de entorno

---

## 📦 Requisitos Previos

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB** >= 6.x (local o Atlas)
- Cuenta en **Resend** para envío de emails
- Cuenta en **Cloudinary** para almacenamiento de imágenes

---

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd Pet-adoption-backend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
```

### 4. Configurar MongoDB
- **Opción 1 - Local:** Asegúrate de tener MongoDB ejecutándose localmente
- **Opción 2 - Atlas:** Crea un cluster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### 5. Configurar Resend
1. Crear cuenta en [Resend](https://resend.com/)
2. Verificar un dominio o email
3. Obtener API Key
4. Configurar en `.env`

---

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Servidor
PORT=8080

# Base de datos
MONGODB_CNN=mongodb://localhost:27017/pet-adoption

# JWT
SECRETORPRIVATEKEY=tu-clave-secreta-super-segura

# Frontend
FRONTEND_URL=http://localhost:5173

# Email
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=noreply@tudominio.com
```

> **💡 Tip:** Usa `.env.example` como plantilla

---

## 🎯 Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor estará disponible en `http://localhost:8080` (o el puerto configurado)

---

## 📁 Estructura del Proyecto

```
Pet-adoption-backend/
├── controllers/              # Lógica de negocio
│   ├── auth.js              # Autenticación y recuperación
│   ├── comunidad.js         # Gestión de comunidad
│   ├── publicaciones.js     # CRUD de publicaciones
│   └── usuarios.js          # Gestión de usuarios
├── database/
│   └── config.js            # Configuración MongoDB
├── helpers/
│   ├── enviar-mails.js      # Servicio de emails
│   └── generar-jwt.js       # Generación de tokens
├── middlewares/
│   ├── validar-campos.js    # Validación de datos
│   ├── validar-jwt.js       # Verificación de tokens
│   └── validar-roles.js     # Control de permisos
├── models/
│   ├── comunidad.js         # Esquema de posts
│   ├── publicacion.js       # Esquema de publicaciones
│   ├── server.js            # Configuración del servidor
│   └── usuario.js           # Esquema de usuarios
├── routes/
│   ├── auth.js              # Rutas de autenticación
│   ├── comunidad.js         # Rutas de comunidad
│   ├── publicaciones.js     # Rutas de publicaciones
│   └── usuarios.js          # Rutas de usuarios
├── .env.example             # Plantilla de variables
├── index.js                 # Punto de entrada
├── package.json             # Dependencias y scripts
└── README.md                # Documentación
```

---

## 🌐 API Endpoints

### Autenticación (`/api/auth`)

| Método | Endpoint | Acceso | Descripción |
|--------|----------|--------|-------------|
| POST | `/login` | Público | Iniciar sesión |
| POST | `/forgot-password` | Público | Solicitar reset de contraseña |
| POST | `/reset-password/:token` | Público | Resetear contraseña |
| GET | `/me` | Privado | Obtener usuario logueado |

### Usuarios (`/api/usuarios`)

| Método | Endpoint | Acceso | Descripción |
|--------|----------|--------|-------------|
| GET | `/` | Admin | Listar todos los usuarios |
| POST | `/` | Público | Registrar nuevo usuario |
| GET | `/mi-perfil` | Usuario | Ver perfil propio |
| PUT | `/mi-perfil` | Usuario | Actualizar perfil |
| GET | `/:id` | Propietario/Admin | Ver usuario específico |
| PUT | `/:id` | Propietario/Admin | Actualizar usuario |
| PUT | `/:id/estado` | Admin | Cambiar estado del usuario |
| DELETE | `/:id` | Propietario/Admin | Eliminar usuario |

### Publicaciones (`/api/publicaciones`)

| Método | Endpoint | Acceso | Descripción |
|--------|----------|--------|-------------|
| GET | `/` | Público | Listar publicaciones (paginado) |
| GET | `/:id` | Público | Ver publicación específica |
| GET | `/usuario/:id` | Propietario/Admin | Ver publicaciones de un usuario |
| GET | `/contacto/:id` | Autenticado | Obtener datos de contacto |
| GET | `/admin/todas` | Admin | Ver todas (incluye inactivas) |
| POST | `/` | Autenticado | Crear publicación |
| PUT | `/:id` | Propietario/Admin | Actualizar publicación |
| PUT | `/:id/estado` | Propietario/Admin | Cambiar estado |
| DELETE | `/:id` | Propietario/Admin | Eliminar publicación |

**Parámetros de búsqueda (GET `/`):**
- `page` - Número de página (default: 1)
- `limit` - Resultados por página (max: 50, default: 12)
- `tipo` - PERDIDO, ENCONTRADO, ADOPCION
- `estado` - Estado específico de la publicación
- `search` - Búsqueda en raza, detalles, lugar

### Comunidad (`/api/comunidad`)

| Método | Endpoint | Acceso | Descripción |
|--------|----------|--------|-------------|
| GET | `/` | Público | Listar posts de comunidad |
| GET | `/:id` | Público | Ver post específico |
| POST | `/` | Admin | Crear post |
| PUT | `/:id` | Admin | Actualizar post |
| DELETE | `/:id` | Admin | Eliminar post |

---

## 📊 Modelos de Datos

### Usuario
```javascript
{
  nombre: String,           // 3-40 caracteres
  correo: String,           // Único, máx 35 caracteres
  password: String,         // Hash bcrypt
  telefono: String,         // 7-15 dígitos
  img: String,              // Opcional
  rol: "ADMIN_ROLE" | "USER_ROLE",
  estado: Boolean,          // Activo/Inactivo
  resetToken: String,       // Token de recuperación
  resetTokenExp: Date       // Expiración del token
}
```

### Publicación
```javascript
{
  tipo: "PERDIDO" | "ENCONTRADO" | "ADOPCION",
  nombreanimal: String,     // Max 60 caracteres
  especie: "PERRO" | "GATO" | "AVE" | "CONEJO" | "OTRO",
  estado: String,           // 7 estados diferentes
  raza: String,             // Max 40 caracteres
  sexo: "MACHO" | "HEMBRA" | "DESCONOZCO",
  tamaño: "MINI" | "PEQUEÑO" | "MEDIANO" | "GRANDE" | "SIN ESPECIFICAR",
  color: String,            // Max 80 caracteres
  detalles: String,         // Max 250 caracteres
  edad: "CACHORRO" | "JOVEN" | "ADULTO" | "MAYOR" | "SIN ESPECIFICAR",
  
  // Campos condicionales según tipo
  lugar: String,            // Para PERDIDO/ENCONTRADO
  fecha: String,            // Para PERDIDO/ENCONTRADO
  afinidad: String,         // Para ADOPCION
  afinidadanimales: String, // Para ADOPCION
  energia: String,          // Para ADOPCION
  castrado: Boolean,        // Para ADOPCION
  
  whatsapp: String,         // 10-15 dígitos
  usuario: ObjectId,        // Referencia a Usuario
  img: String,              // URL Cloudinary
  fechaCreacion: Date
}
```

### Comunidad
```javascript
{
  titulo: String,           // Max 80 caracteres
  contenido: String,        // Max 3000 caracteres
  categoria: "HISTORIA" | "ALERTA",
  img: String,              // URL Cloudinary
  usuario: ObjectId,        // Referencia a Usuario
  fechaCreacion: Date
}
```

---

## 🔐 Autenticación

### Sistema JWT

El sistema utiliza **JSON Web Tokens** con las siguientes características:

- **Duración:** 4 horas
- **Header:** `x-token`
- **Payload:** `{ uid: userId }`

### Flujo de Autenticación

1. **Login:** Usuario envía correo y contraseña
2. **Validación:** Se verifica credenciales con bcrypt
3. **Token:** Se genera JWT con el ID del usuario
4. **Response:** Se devuelve usuario y token
5. **Requests:** Cliente incluye token en header `x-token`

### Ejemplo de Uso

```javascript
// Login
POST /api/auth/login
{
  "correo": "usuario@example.com",
  "password": "123456"
}

// Response
{
  "usuario": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Usar token en siguientes requests
GET /api/usuarios/mi-perfil
Headers: {
  "x-token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Recuperación de Contraseña

1. Usuario solicita reset con su correo
2. Se genera token único (válido 1 hora)
3. Se envía email con enlace de reset
4. Usuario accede al enlace y establece nueva contraseña

---

## 🔑 Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `8080` |
| `MONGODB_CNN` | URL de conexión MongoDB | `mongodb://localhost:27017/pet-adoption` |
| `SECRETORPRIVATEKEY` | Clave secreta JWT | `mi-clave-super-secreta-123` |
| `FRONTEND_URL` | URL del frontend | `https://perdidosyadopciones.com.ar` |
| `RESEND_API_KEY` | API Key de Resend | `re_xxxxxxxxxxxx` |
| `RESEND_FROM` | Email verificado en Resend | `noreply@tudominio.com` |

> ⚠️ **Importante:** Nunca subas el archivo `.env` a Git

---

## 📜 Scripts Disponibles

```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm start
```

## 🧪 Testing

El proyecto utiliza **Postman** para pruebas manuales de la API. 

### Colección de Postman

Para facilitar las pruebas, se recomienda crear una colección con:

- **Variables de entorno:**
  - `{{base_url}}` = `http://localhost:8080/api`
  - `{{token}}` = Token JWT obtenido en login

- **Carpetas organizadas:**
  - Auth (Login, Forgot Password, Reset Password, Me)
  - Usuarios (CRUD completo)
  - Publicaciones (CRUD + Filtros + Búsqueda)
  - Comunidad (CRUD)

### Flujo de Pruebas Recomendado

1. **Registro:** POST `/usuarios` → Crear usuario
2. **Login:** POST `/auth/login` → Guardar token
3. **Autenticación:** GET `/auth/me` → Verificar token
4. **CRUD:** Probar endpoints según necesidad
5. **Permisos:** Verificar roles (Admin vs Usuario)

---

## 🚢 Despliegue

### Variables de Entorno en Producción

Asegúrate de configurar todas las variables en tu servicio de hosting:

- Railway
- Heroku
- AWS
- DigitalOcean
- Vercel (solo para APIs)

### CORS en Producción

El servidor está configurado para aceptar requests de:
- `https://perdidosyadopciones.com.ar`
- `https://www.perdidosyadopciones.com.ar`

Actualiza los orígenes en `models/server.js` según tu dominio.

### Recomendaciones

1. ✅ Usar MongoDB Atlas en producción
2. ✅ Configurar variables de entorno en el hosting
3. ✅ Habilitar HTTPS
4. ✅ Configurar dominio personalizado
5. ✅ Implementar rate limiting (próximamente)
6. ✅ Agregar monitoring (PM2, New Relic)

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la Licencia ISC.

---

## 👨‍💻 Autor

**STCzin**

---

## 🙏 Agradecimientos

- Express.js por el excelente framework
- MongoDB por la base de datos
- Resend por el servicio de emails
- Cloudinary por el almacenamiento de imágenes

---

## 📞 Soporte

Para reportar bugs o solicitar features, por favor abre un issue en el repositorio.

---

**Desarrollado con ❤️ para ayudar a las mascotas perdidas a encontrar su hogar**
