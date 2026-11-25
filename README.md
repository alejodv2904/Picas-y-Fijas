# Picas y Fijas (2 jugadores, tiempo real)

Juego de adivinar el número de **4 dígitos distintos** del rival. App web instalable (PWA) que funciona en **Android e iOS** y se conecta en tiempo real por WebSocket.

- **Fija**: dígito correcto en la posición correcta. **Pica**: dígito correcto en otra posición. Gana quien logre 4 fijas.
- Un jugador crea la sala y comparte el código (o enlace `?sala=CODIGO`); el otro se une. Cada uno elige su secreto y juegan por turnos. Hay revancha y reconexión automática.
- El servidor es autoritativo: los números secretos nunca se envían al rival hasta que termina la partida.

## Ejecutar
```bash
npm install
npm start        # http://localhost:3000
npm test
```

## Publicar (necesita un host con WebSockets: Render, Railway, Fly.io, un VPS…)
Es un solo proceso Node (`npm start`, usa `PORT`). Vercel serverless **no** sirve para WebSockets.
Con HTTPS en la URL pública, el cliente usa `wss://` automáticamente.

## Instalar en el celular
- **Android (Chrome)**: menú ⋮ → *Instalar aplicación*.
- **iOS (Safari)**: Compartir → *Añadir a pantalla de inicio*.

## APK / App Store (opcional)
La web ya es una PWA. Para empaquetarla: Android → [Bubblewrap/TWA](https://github.com/GoogleChromeLabs/bubblewrap) o Capacitor; iOS → Capacitor (requiere Mac y cuenta de Apple Developer).
