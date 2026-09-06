# TODO — "El viaje de Day" (el juego)

Un juego de una sola pantalla: nadas una ballena, desciendes por el océano,
recoges 7 luces y la ballena emerge con el mensaje final. Regalo digital.
Estática (HTML + CSS + JS, sin librerías). Marca cada tarea con `[x]`.

## Setup
- [x] Estructura: `css/`, `js/`, `audio/`, `assets/`
- [x] `index.html`: canvas a pantalla completa + HUD + pantallas
- [x] Fuentes Google: Playfair Display (títulos), Inter (UI), Oswald (etiquetas)
- [x] Paleta océano nocturno + acentos violeta/oro; `prefers-reduced-motion`

## Cambios pedidos (última pasada)
- [x] Título principal: solo **"Day"**
- [x] Al recoger una luz: **la ballena hace una voltereta feliz** (giro + saltito) + chispas + sonido
- [x] Al fondo del mar: **el Titanic** (barco partido en dos, portillas con luz
      cálida). Al juntar las 7 luces baja una escena de "reveal" a enseñarlo antes de emerger
- [x] Textos ("texto aquí") reemplazados por texto propio (intro + mensaje final + firma); editables
- [x] **Se quitó la letra sincronizada** y se cambió por interacción viva:
      · rastro bioluminiscente al nadar
      · banco de peces que huyen de la ballena y del cursor
      · destello (clic / barra espaciadora): anillo que dispersa a los peces
- [x] **Sorpresa en cada luz**: al tocar cada una de las 7 aparece un animal
      distinto de las profundidades, hace lo suyo unos segundos y se va —
      Medusa, Cardumen, Pulpo, Mantarraya, Pez linterna, Calamar gigante,
      Sifonóforo (de menos a más raro según la profundidad), con su nombre
- [x] Más simple: menos partículas, menos rayos de luz

## El juego (js/game.js)
- [x] Lienzo full-screen, DPR-aware, resize
- [x] Control: cursor / dedo (arrastrar) / flechas o WASD; la ballena sigue el
      objetivo con easing y se inclina y gira hacia donde nada
- [x] Descenso: la ballena baja sola despacio; si sueltas el control baja más
      rápido (siempre hay movimiento)
- [x] Cámara que sigue a la ballena hacia abajo
- [x] Ballena dibujada en canvas: cuerpo con meneo senoidal a lo largo del
      espinazo, cola que aletea, aleta pectoral, surcos ventrales, ojo, glow,
      degradado lavanda→violeta; da la vuelta al cambiar de dirección
- [x] Océano: degradado que se oscurece con la profundidad, rayos de luz
      (godrays) que se mecen y se apagan al bajar, halo violeta que crece,
      "marine snow", burbujas de estela, viñeta
- [x] 7 luces (lightsticks) repartidas en la bajada; al recoger una: estallido
      de chispas + palabra que sube (morado, coreo, el 7, México, lightstick,
      Danger, ARMY) + sonido corto (WebAudio) + contador "x / 7"
- [x] Contador de profundidad flotante ("-X m")
- [x] Al juntar las 7: secuencia de emersión (la ballena sube acelerando, el
      fondo vira a un amanecer, los rayos se intensifican) → pantalla final
- [x] Pantalla final con mensaje editable + "Volver a nadar" (NO reinicia la música)

## Música
- [x] Banda sonora ambiental generada por código (WebAudio), original y sin
      derechos de autor: pad grave que cambia de acorde muy despacio + notas
      sueltas de escala pentatónica con eco. Objeto `Music` en `js/game.js`.
- [x] Arranca al pulsar "Súmergete" (necesita el gesto para el AudioContext)
- [x] Botón flotante tipo pill para silenciar/reanudar (aparece al empezar)

## Calidad
- [x] Cero errores/warnings de consola (verificado: arranque, música, HUD)
- [x] Animación por transform/opacity en la UI; canvas a 60fps con dt
- [x] Responsive: canvas se adapta; controles táctiles; HUD escala
- [x] `prefers-reduced-motion`: menos partículas, sin mecido de rayos, meneo
      de ballena más suave (el juego sigue siendo jugable)
- [x] Se pausa el bucle cuando la pestaña está oculta
- [x] Comentarios por bloque en `game.js`; ajustes al inicio del archivo

> Nota: el bucle del juego (requestAnimationFrame continuo) no se puede simular
> en captura headless, así que la jugabilidad completa (descenso, recoger las 7,
> emersión, pantalla final) hay que verla abriendo `index.html` en un navegador
> real. El primer fotograma, el arranque de audio y la UI sí están verificados.
