# Picas y Fijas (2 jugadores, tiempo real)

Página web estática (PWA) para jugar **Picas y Fijas con 4 dígitos distintos** entre dos celulares, Android o iOS. **No necesita servidor propio**: los dos celulares se conectan directamente (WebRTC con PeerJS) y el del jugador que crea la partida hace de árbitro.

- **Fija**: dígito correcto en la posición correcta. **Pica**: dígito correcto en otra posición. Gana quien saque 4 fijas.
- Un jugador crea la partida y comparte el código (o el enlace `?sala=CODIGO`); el otro se une.
- Los resultados se muestran como "2 picas y 1 fija", "3 fijas", "1 pica" o "Nada".
- Hay revancha. Si el invitado pierde la señal, se reconecta solo. Si el anfitrión cierra o recarga la página, la partida se acaba.

## Publicar
Es solo la carpeta `public/`; sirve en cualquier hosting estático con HTTPS (Vercel, Netlify, GitHub Pages…). En Vercel: *Root Directory* = `public`, sin comando de build.

## Instalar en el celular
- **Android (Chrome)**: menú ⋮ → *Instalar aplicación*.
- **iOS (Safari)**: Compartir → *Añadir a pantalla de inicio*.

## Desarrollo
```bash
npm start   # sirve public/ en http://localhost:3000
npm test    # reglas del juego
```
Nota: el "apretón de manos" inicial pasa por el servidor público gratuito de PeerJS (0.peerjs.com); las jugadas viajan directo entre los celulares. Algunas redes muy restrictivas (p. ej. wifi corporativo) pueden bloquear la conexión directa.
