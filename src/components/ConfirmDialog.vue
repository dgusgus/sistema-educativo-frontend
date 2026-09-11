<script setup lang="ts">
import { useConfirmState } from '@/composables/useConfirm'
const { abierto, opciones, responder } = useConfirmState()
</script>

<template>
  <dialog :open="abierto" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-2">{{ opciones.titulo ?? 'Confirmar acción' }}</h3>
      <p class="text-sm text-base-content/70">{{ opciones.mensaje }}</p>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="responder(false)">
          {{ opciones.textoCancelar ?? 'Cancelar' }}
        </button>
        <button
          class="btn"
          :class="opciones.peligroso ? 'btn-error' : 'btn-primary'"
          @click="responder(true)"
        >
          {{ opciones.textoConfirmar ?? 'Confirmar' }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="responder(false)"><button>cerrar</button></form>
  </dialog>
</template>