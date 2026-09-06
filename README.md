# El viaje de Day — el juego

Un juego de una sola pantalla: **nadas una ballena** con el cursor (o el dedo, o
las flechas), desciendes por el océano, recoges **7 luces moradas** y, al juntarlas,
la ballena **emerge a la superficie** con el mensaje final. Regalo digital.
La música es una pieza ambiental **generada por código** (sin archivos ni derechos de autor); arranca al pulsar «Súmergete».

## Cómo verlo / jugarlo

Abre `index.html` en el navegador (doble clic). No necesita servidor ni build.
Internet solo la primera vez (fuentes de Google).

- **Cursor / dedo:** la ballena nada hacia donde apuntas (arrastra en móvil).
- **Flechas o WASD:** también sirven.
- Si sueltas el control, la ballena sigue bajando sola.
- Objetivo: recoger las **7 luces**. Al tenerlas todas, emerge y aparece el final.
- Botón **Música** (abajo izq.) para silenciar/reanudar. **Volver a nadar** reinicia
  el juego sin cortar la música.

> **Stack:** el encargo pedía Next.js 14. En esta máquina no hay Node, así que es
> un juego estático en `<canvas>` + JS puro (sin librerías). No hay paso de build.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Canvas + HUD + pantallas de inicio/final. |
| `css/styles.css` | Solo UI (pantallas, HUD, botón de audio). El océano se dibuja en canvas. |
| `js/game.js` | Todo el juego: control, ballena, océano, peces, luces, Titanic, emersión, música. |
| `audio/` | Vacía — la música se genera por código (ver `audio/LEEME.md`). |
| `assets/` | Vacía (por si quieres meter algo). |

## Interacción (además de nadar y recoger)

- **Sorpresa en cada luz**: al tocar cada una de las 7 luces despierta un animal
  de las profundidades distinto — Medusa, Cardumen, Pulpo, Mantarraya, Pez
  linterna, Calamar gigante y Sifonóforo (de menos a más raro cuanto más hondo).
  Aparece cerca, hace lo suyo unos segundos con su nombre en pantalla y se marcha.
- **Rastro**: la ballena deja un reguero de luz al moverse.
- **Peces**: un banco de peces pequeños huye de la ballena y del cursor.
- **Destello**: clic o barra espaciadora → la ballena lanza un anillo que
  dispersa a los peces y aviva las partículas.

Ajustar los animales: array `CREATURE_NAMES` y función `spawnCreature` /
`drawCreature` en `js/game.js`.

## Textos

El título ("Day"), la frase de la intro, el **mensaje final** y la firma ya tienen
texto propio en `index.html` (marcados con `<!-- Texto libre -->`). Cámbialos por
lo que quieras decirle.

## Ajustes rápidos (`js/game.js`)

- `LIGHT_COUNT` — cuántas luces (7).
- `ACTIVE_SINK` / `IDLE_SINK` — rapidez del descenso.
- Música: objeto `Music` en `js/game.js` (acordes `CHORDS`, escala `SCALE`, volumen `master.gain`).
- Posición de las luces y del pecio: función `reset()` (`lights`, `wreck.wy`).
- Voltereta al recoger: `whale.gestureT = 0.85` en la sección "recoger luces".
- Dibujos: `drawWhale()` (la ballena), `drawWreck()` (el Titanic), `render()` (océano).
- Duración de la escena del pecio / de la emersión: `revealT > 3.8` / `ascendT > 3.8`.

## Verificado

- Cero errores/warnings de consola (arranque, «Súmergete», música, HUD).
- Sintaxis JS válida; primer fotograma del juego renderiza (ballena + océano + HUD + luz).
- Responsive (desktop y móvil) en las pantallas de inicio.

> **No verificable en headless:** la jugabilidad continua (nadar, descender,
> recoger las 7, emersión, pantalla final) depende de `requestAnimationFrame`
> corriendo de verdad. Ábrelo en un navegador para probarlo entero.
