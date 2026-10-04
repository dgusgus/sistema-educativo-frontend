import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth.store'
import './style.css'

const app = createApp(App)

// 1. Pinia primero — el router va a necesitar acceder a los stores
//    en los navigation guards (para verificar si hay token, qué rol tiene, etc.)
app.use(createPinia())

// 2. Router después — sus guards ya pueden usar useAuthStore()
app.use(router)

// 3. Con sesión guardada, se confirma con el backend al abrir la app.
//    El backend ahora toma los roles y el estado de la cuenta desde la base de
//    datos en cada petición, así que lo guardado en localStorage puede estar
//    desfasado (cambiaron sus roles, desactivaron la cuenta, cambiaron la
//    contraseña desde otro equipo). Si la sesión ya no vale, el interceptor
//    responde al 401 limpiando todo y enviando al login con el motivo.
const auth = useAuthStore()
if (auth.estaAutenticado) {
  auth.refreshMe().catch(() => { /* sin red: se reintenta en la próxima acción */ })
}

app.mount('#app')