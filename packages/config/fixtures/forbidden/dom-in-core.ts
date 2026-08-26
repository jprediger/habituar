// Deve falhar no typecheck: a base não carrega a lib DOM.
export const leak = document.querySelector('body')
