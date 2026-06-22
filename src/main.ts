import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// 1. Pinia primero — el router va a necesitar acceder a los stores
//    en los navigation guards (para verificar si hay token, qué rol tiene, etc.)
app.use(createPinia())

// 2. Router después — sus guards ya pueden usar useAuthStore()
app.use(router)

app.mount('#app')