# Un recuerdo para ti

Entrega de souvenirs por persona, agrupados por familia. Node.js 22 o posterior, sin dependencias.

Los invitados reales se consultan desde Supabase. `invitados.demo.json` contiene únicamente cuatro grupos ficticios para pruebas locales. Los niños son adicionales a los adultos y cada persona recibe un souvenir.

## Base de datos

La base de Supabase ya está configurada. La migración original con nombres reales permanece solo en esta computadora, excluida de Git mediante `.gitignore`. No es necesaria para desplegar la app y no debe ejecutarse otra vez.

## Uso

La app abre directamente la lista, sin contraseña. Cada grupo tiene secciones independientes para adultos y niños. Usa +1 regalo, Completar o −1 regalo dentro del tipo correspondiente. Completar solo entrega los regalos de ese tipo; el otro contador permanece igual. Los filtros muestran todos, pendientes (incluye parciales), parciales y completados. El resumen y el progreso cuentan souvenirs, no grupos.

Se registra la cantidad acumulada y la fecha de la última actualización. No se solicita el nombre de quien entrega. No hay historial individual ni identificación de qué adulto o niño recibió cada souvenir. Actualizar consulta los cambios de otros operadores; el servidor verifica la cantidad previa para evitar sobrescribir una entrega concurrente.

## Configuración y modo local

Copia .env.example a .env si no existe y configura SUPABASE_URL y SUPABASE_SECRET_KEY. La clave privada queda en el servidor. Sin Supabase, se cargan grupos ficticios en memoria y las entregas se reinician al reiniciar el servidor. La lista de Supabase se carga de la base de datos; editar invitados.demo.json no cambia la base automáticamente.

El servidor escucha en 127.0.0.1. Las fechas usan la zona horaria del dispositivo. Mantén RLS en Supabase. Esta versión no está publicada; el acceso actual es local y sin contraseña. No compartas .env.

## Validación

npm test verifica totales, entregas parciales y completas, correcciones, cantidades inválidas, conflictos y protección de archivos privados, sin conectarse a Supabase.

## Publicar en Netlify desde GitHub

1. En tu cuenta de Netlify, importa un proyecto existente desde GitHub y selecciona `AndreeW484/birthday-souvenir-checklist`, rama `main`.
2. Netlify lee `netlify.toml`: comando `npm test`, carpeta publicada `public`, funciones en `netlify/functions` y Node 24. No uses `npm start` como comando de build.
3. En las variables de entorno de Netlify, agrega `SUPABASE_URL` y `SUPABASE_SECRET_KEY` con los valores de tu `.env`, disponibles para Functions. No subas `.env` a GitHub ni pegues la clave en el frontend.
4. Despliega el sitio. Si agregas o cambias las variables después del despliegue, vuelve a desplegarlo.
5. Abre la URL HTTPS en el celular y verifica la lista y los totales de tu evento. La app usa la tabla existente: no vuelvas a ejecutar la migración SQL.

El sitio abre sin contraseña y quien tenga acceso al enlace puede consultar y modificar las entregas. La clave de Supabase queda en las funciones. Si faltan las variables, el despliegue responde con un error de configuración en lugar de activar el modo de ejemplo.

La API de Node local y la función de Netlify comparten `api.mjs`. Las pruebas de Netlify simulan Supabase y no alteran entregas reales.

## Separar regalos de adultos y niños

Antes de desplegar esta versión, ejecuta `migrations/002_entregas_por_tipo.sql` en el SQL Editor de Supabase. Agrega contadores independientes y conserva las entregas anteriores cuando su tipo puede deducirse. Si hay entregas parciales en grupos mixtos, la transacción se detiene sin cambiar datos para que se puedan clasificar. El archivo no contiene datos personales. Una segunda ejecución se detiene porque las columnas ya existen.

El resumen muestra entregados y pendientes de adultos y de niños. La actualización verifica ambos contadores anteriores para evitar sobrescribir cambios concurrentes, y la base impide cantidades superiores al número de personas de cada tipo. Una versión antigua de la web no puede cambiar únicamente el total después de la migración; recarga la página tras desplegar.
