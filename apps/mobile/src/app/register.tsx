// A tela vive em `authentication/` porque todo arquivo dentro de `app/` é rota: um
// `register-screen.test.tsx` aqui viraria a rota `/register-screen.test`.
export { RegisterScreen as default } from '../authentication/register-screen'
