// A tela vive em `authentication/` porque todo arquivo dentro de `app/` é rota: um
// `login-screen.test.tsx` aqui viraria a rota `/login-screen.test`.
export { LoginScreen as default } from '../authentication/login-screen'
