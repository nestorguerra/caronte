// Synthetic pagination fixture. Not a customer interview or model-written book.
export function printManuscript() {
  const words = ('La memoria tenía una puerta estrecha y una silla junto a la ventana. ' +
    'Todavía recordaba la conversación, el café recién hecho, la música del sábado y aquella pregunta: ' +
    '¿qué habrías elegido si hubieras prestado atención? No era una profecía. ' +
    'Era una prueba de texto, con tildes, ñ, comillas «españolas» y signos de apertura.').split(/\s+/);
  return {
    title: 'Todavía, mañana', subtitle: 'Prueba técnica de maquetación. Texto sintético.',
    current_age: 50, future_age: 90, source_session_id: 'synthetic-print-proof',
    prompt_version: 'caronte-literary-v2', editorial_status: 'awaiting_human_review',
    target_pages: {min: 180, max: 200, verified: false},
    sections: Array.from({length: 5}, (_, chapter) => ({
      id: `ch_0${chapter + 1}`, kind: 'chapter', title: ['La puerta', 'La atención', 'El regreso', 'Lo que permanece', 'Todavía'][chapter],
      paragraphs: Array.from({length: 30}, (_, paragraph) =>
        [`INICIO${chapter + 1}P${paragraph + 1}`,
          ...Array.from({length: 320}, (_, index) => words[(index + paragraph) % words.length]),
          `FIN${chapter + 1}P${paragraph + 1}`].join(' '))
    }))
  };
}
