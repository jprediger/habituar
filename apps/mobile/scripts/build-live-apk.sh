#!/usr/bin/env sh
# APK release autônomo (JS embutido, sem Metro) apontando para a API do ambiente live.
# Uso: EXPO_PUBLIC_API_ORIGIN=https://<domínio>.ngrok-free.app pnpm --filter @habituar/mobile android:apk:live
set -eu

# Exigida no shell, não lida do `.env`: o `.env` aponta para o emulador ou para a rede local,
# e cair nele em silêncio gera um APK que só funciona na mesma rede de quem o compilou.
: "${EXPO_PUBLIC_API_ORIGIN:?Set EXPO_PUBLIC_API_ORIGIN to the live API origin, e.g. https://<domain>.ngrok-free.app}"
case "$EXPO_PUBLIC_API_ORIGIN" in
  https://*) ;;
  *) echo "EXPO_PUBLIC_API_ORIGIN must be an https origin to work on any network" >&2; exit 1 ;;
esac
export EXPO_PUBLIC_API_ORIGIN
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

cd "$(dirname "$0")/.."

# O Metro resolve os pacotes do workspace pelo `dist`, que precisa estar atualizado.
pnpm --workspace-root exec turbo run build --filter "@habituar/mobile^..."
# Sincroniza `android/` com o `app.json`; o diretório é gerado e não versionado.
EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --platform android --no-install
# Só arm64: é a arquitetura de praticamente todo aparelho físico, e compilar o nativo para as
# quatro do template, em paralelo, esgota CPU e memória da máquina. Workers limitados pelo
# mesmo motivo; `GRADLE_WORKERS` ajusta quando a máquina aguenta mais. O `ninja` do C++ não
# respeita `--max-workers` e abre um processo por núcleo, por isso o limite próprio. `nice`
# e `ionice` mantêm a interface responsiva; o daemon é encerrado no fim para devolver a RAM.
WORKERS="${GRADLE_WORKERS:-2}"
export CMAKE_BUILD_PARALLEL_LEVEL="$WORKERS"
export NINJAFLAGS="-j$WORKERS"
(cd android && nice -n 19 ionice -c 3 ./gradlew assembleRelease \
  -PreactNativeArchitectures=arm64-v8a \
  --max-workers="$WORKERS" \
  -Dorg.gradle.parallel=false \
  -Dorg.gradle.jvmargs="-Xmx1536m -XX:MaxMetaspaceSize=512m" \
  -Dkotlin.daemon.jvm.options=-Xmx768m; status=$?; ./gradlew --stop >/dev/null 2>&1; exit $status)

APK=android/app/build/outputs/apk/release/app-release.apk
# Prova de que a origem certa entrou no bundle: um daemon do Gradle iniciado por outro
# shell, ou uma regra de `.env` com precedência inesperada, trocaria a URL sem erro algum.
if ! unzip -p "$APK" assets/index.android.bundle | grep -aqF "$EXPO_PUBLIC_API_ORIGIN"; then
  echo "Built bundle does not contain $EXPO_PUBLIC_API_ORIGIN; refusing to hand out this APK" >&2
  exit 1
fi
echo "APK pronto: $(pwd)/$APK"
