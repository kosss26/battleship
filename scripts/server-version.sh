#!/usr/bin/env bash
# Switch the existing HOSTKEY installation without checking out another branch
# in its working directory or touching the database container/volume.
set -Eeuo pipefail
umask 077

ROOT=${BATTLESHIP_ROOT:-/opt/battleship}
WEB=${BATTLESHIP_WEBROOT:-/opt/battleship-www}
STATE=${BATTLESHIP_SWITCH_STATE:-/root/battleship-version-switch}
DOMAIN=${BATTLESHIP_DOMAIN:-https://battleship.77.91.112.63.nip.io}
BACKEND=${BATTLESHIP_BACKEND:-battleship-backend}
DB=${BATTLESHIP_DB:-battleship-db}
HEALTH=${BATTLESHIP_HEALTH_URL:-http://127.0.0.1:3400/api/health}
ATTEMPTS=${BATTLESHIP_HEALTH_ATTEMPTS:-45}
INTERVAL=${BATTLESHIP_HEALTH_INTERVAL:-1}
MODE=${1:-status}
STAMP=$(date -u +%Y%m%d-%H%M%S)-$$
TAG_PREFIX=battleship-backend
COMPOSE=$ROOT/deploy-hostkey/docker-compose.yml
transition=0
previous_image=
previous_web=

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nОШИБКА: %s\n' "$*" >&2; exit 1; }
read_state() { cat "$STATE/$1"; }
save_state() { printf '%s\n' "$2" > "$STATE/$1.tmp"; mv -f "$STATE/$1.tmp" "$STATE/$1"; }
image_id() { docker image inspect "$1" --format '{{.Id}}'; }
container_image() { docker inspect "$BACKEND" --format '{{.Image}}'; }

case "$MODE" in test|deploy|original|status) ;; *) die 'Использование: server-version.sh test|original|status|deploy' ;; esac
for command in git docker python3 curl gzip flock; do command -v "$command" >/dev/null || die "Не найдена команда: $command"; done
[[ -d "$ROOT/.git" && -f "$COMPOSE" ]] || die "Не найдена серверная установка в $ROOT"
[[ -L "$WEB/current" ]] || die "Ожидается символическая ссылка $WEB/current"
[[ ! -L "$STATE" ]] || die 'Папка снимков не должна быть символической ссылкой'
mkdir -p "$STATE"
chmod 700 "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || die 'Уже выполняется другое переключение'
docker info >/dev/null

write_override() {
  python3 - "$STATE/active-override.json" "$1" <<'PY'
import json, os, sys
path, image = sys.argv[1:]
with open(path + '.tmp', 'w') as f:
    json.dump({'services': {'backend': {'image': image, 'pull_policy': 'never'}}}, f)
os.replace(path + '.tmp', path)
PY
}

with_override() {
  local override=$1
  shift
  (cd "$ROOT"; docker compose -p "$(read_state project)" --project-directory "$ROOT/deploy-hostkey" -f "$STATE/original-compose.yml" -f "$override" "$@")
}
compose() { with_override "$STATE/active-override.json" "$@"; }

switch_web() {
  local target=$1 next=$WEB/.current-switch-$$
  [[ -d "$target" && -f "$target/index.html" ]] || { printf 'Не найдена сборка: %s\n' "$target" >&2; return 1; }
  rm -f "$next"
  ln -s "$target" "$next"
  mv -Tf "$next" "$WEB/current"
}

wait_health() {
  local n
  for ((n=1; n<=ATTEMPTS; n++)); do
    if curl -fsS --max-time 3 "$HEALTH" >/dev/null 2>&1; then return 0; fi
    sleep "$INTERVAL"
  done
  printf 'Backend не прошёл проверку %s\n' "$HEALTH" >&2
  return 1
}

recover() {
  local code=$1 backend_ok=0 web_ok=0
  trap - ERR INT TERM HUP
  set +e
  if ((transition)); then
    say 'Переключение не завершилось. Возвращаю предыдущую версию'
    write_override "$previous_image"
    compose up -d --no-build --no-deps --force-recreate backend && wait_health && backend_ok=1
    switch_web "$previous_web" && web_ok=1
    if ((backend_ok && web_ok)); then
      printf 'Предыдущая версия восстановлена. База не откатывалась.\n' >&2
    else
      printf 'Автовосстановление не удалось полностью. Запустите: bash %q original\n' "$0" >&2
      printf 'Снимки сохранены в %s; база и её контейнер не удалялись.\n' "$STATE" >&2
    fi
  else
    printf '\nПодготовка остановлена. Работающая версия не переключалась.\n' >&2
  fi
  exit "$code"
}
trap 'recover $?' ERR
trap 'recover 130' INT
trap 'recover 143' TERM
trap 'recover 129' HUP

initialize() {
  [[ -f "$STATE/initialized" ]] && return
  say 'Сохраняю оригинальную версию и конфигурацию (значения секретов не выводятся)'
  [[ -z "$(git -C "$ROOT" status --porcelain)" ]] || die 'В серверном репозитории есть локальные изменения. Ничего не переключено.'
  local project backend_service db_project db_service original_id original_tag original_web saved_web
  project=$(docker inspect "$BACKEND" --format '{{index .Config.Labels "com.docker.compose.project"}}')
  backend_service=$(docker inspect "$BACKEND" --format '{{index .Config.Labels "com.docker.compose.service"}}')
  db_project=$(docker inspect "$DB" --format '{{index .Config.Labels "com.docker.compose.project"}}')
  db_service=$(docker inspect "$DB" --format '{{index .Config.Labels "com.docker.compose.service"}}')
  [[ -n "$project" && "$project" != '<no value>' && "$project" == "$db_project" && "$backend_service" == backend && "$db_service" == db ]] || die 'Контейнеры не соответствуют ожидаемому Compose-проекту'
  (cd "$ROOT"; docker compose -p "$project" --project-directory "$ROOT/deploy-hostkey" -f "$COMPOSE" config --format json) > "$STATE/original-compose.json.tmp"
  python3 - "$STATE" "$ROOT" "$BACKEND" "$DB" <<'PY'
import json, pathlib, sys
state, root, backend, db = sys.argv[1:]
state, root = pathlib.Path(state), pathlib.Path(root).resolve()
config = json.loads((state / 'original-compose.json.tmp').read_text())
services = config['services']
assert services['backend'].get('container_name') == backend, 'Unexpected backend container'
assert services['db'].get('container_name') == db, 'Unexpected database container'
build = services['backend']['build']
if isinstance(build, str): build = {'context': build}
context = pathlib.Path(build['context']).resolve()
context_rel = context.relative_to(root)
dockerfile = pathlib.Path(build.get('dockerfile', 'Dockerfile'))
if not dockerfile.is_absolute(): dockerfile = context / dockerfile
dockerfile_rel = dockerfile.resolve().relative_to(root)
assert not build.get('additional_contexts'), 'Additional build contexts require review'
for volume in services['backend'].get('volumes', []):
    if volume.get('type') == 'bind':
        source = pathlib.Path(volume['source']).resolve()
        assert source != root and root not in source.parents, 'Backend binds the source checkout; review before switching'
environment = services['db'].get('environment', {})
for name, value in {
    'build-context': str(context_rel), 'build-dockerfile': str(dockerfile_rel),
    'db-user': environment.get('POSTGRES_USER', 'postgres'),
    'db-name': environment.get('POSTGRES_DB', environment.get('POSTGRES_USER', 'postgres')),
}.items():
    (state / name).write_text(str(value) + '\n')
PY
  # Keep the source manifest, not re-interpolated resolved environment values.
  # Project directory and cwd preserve relative paths and normal .env lookup.
  cp "$COMPOSE" "$STATE/original-compose.yml"
  chmod 600 "$STATE/original-compose.yml"
  rm -f "$STATE/original-compose.json.tmp"
  save_state project "$project"
  save_state original-commit "$(git -C "$ROOT" rev-parse HEAD)"
  save_state original-branch "$(git -C "$ROOT" branch --show-current)"
  original_id=$(container_image)
  original_tag=$TAG_PREFIX:original-$STAMP
  docker image tag "$original_id" "$original_tag"
  original_web=$(readlink -f "$WEB/current")
  [[ -f "$original_web/index.html" ]] || die 'Не найдена исходная сборка интерфейса'
  saved_web=$WEB/saved/original-$STAMP
  mkdir -p "$saved_web"
  chmod 755 "$WEB/saved"
  cp -a "$original_web/." "$saved_web/"
  chmod -R a+rX "$saved_web"
  save_state original-image "$original_tag"
  save_state original-image-id "$original_id"
  save_state original-live-web "$original_web"
  save_state original-web "$saved_web"
  write_override "$original_tag"
  compose config --quiet
  save_state initialized "$STAMP"
}

activate() {
  local tag=$1 web=$2 label=$3
  image_id "$tag" >/dev/null
  [[ -f "$web/index.html" ]] || die "Не найдена сборка $web"
  write_override "$tag"
  compose config --quiet
  previous_web=$(readlink -f "$WEB/current")
  previous_image=$TAG_PREFIX:before-switch-$STAMP
  docker image tag "$(container_image)" "$previous_image"
  say "Включаю: $label"
  transition=1
  compose up -d --no-build --no-deps --force-recreate backend
  wait_health
  switch_web "$web"
}

finish_activation() {
  transition=0
  printf 'Готово: %s\nАдрес: %s\n' "$1" "$DOMAIN"
}

deploy_test() {
  initialize
  say 'Создаю резервную копию общей базы'
  mkdir -p "$STATE/backups"
  local backup=$STATE/backups/before-test-$STAMP.sql.gz worktree source image release
  docker exec "$DB" pg_dump --username="$(read_state db-user)" --dbname="$(read_state db-name)" | gzip > "$backup.tmp"
  mv -f "$backup.tmp" "$backup"
  save_state latest-db-backup "$backup"
  say 'Получаю тестовую ветку; оригинальный checkout останется без изменений'
  git -C "$ROOT" fetch origin refs/heads/design/naval-home:refs/remotes/origin/design/naval-home
  source=$(git -C "$ROOT" rev-parse --verify 'origin/design/naval-home^{commit}')
  worktree=$STATE/worktrees/$STAMP
  mkdir -p "$STATE/worktrees"
  git -C "$ROOT" worktree add --detach "$worktree" "$(read_state original-commit)"
  if ! git -C "$worktree" -c user.name='Battleship preview deploy' -c user.email='deploy@localhost' merge --no-ff --no-edit "$source"; then
    git -C "$worktree" merge --abort || true
    die 'Конфликт с серверными патчами. Работающая версия не менялась.'
  fi
  image=$TAG_PREFIX:preview-${source:0:10}-$STAMP
  python3 - "$STATE/build-override.json" "$worktree" "$(read_state build-context)" "$(read_state build-dockerfile)" "$image" <<'PY'
import json, pathlib, sys
path, tree, context, dockerfile, image = sys.argv[1:]
tree = pathlib.Path(tree)
assert (tree / dockerfile).is_file(), 'Server Dockerfile missing from merged worktree'
with open(path, 'w') as f:
    json.dump({'services': {'backend': {'image': image, 'build': {'context': str(tree / context), 'dockerfile': str(tree / dockerfile)}}}}, f)
PY
  say 'Собираю отдельный образ backend'
  with_override "$STATE/build-override.json" build backend
  image_id "$image" >/dev/null
  say 'Собираю интерфейс в отдельной папке'
  docker run --rm -v "$worktree:/src" -w /src -e "VITE_API_URL=$DOMAIN/api" -e "VITE_WS_URL=$DOMAIN" node:20-alpine sh -c 'npm ci --no-audit --no-fund && npm run build'
  [[ -f "$worktree/frontend/dist/index.html" ]] || die 'Сборка интерфейса не создала index.html'
  release=$WEB/releases/preview-$STAMP
  mkdir -p "$release"
  cp -a "$worktree/frontend/dist/." "$release/"
  chmod -R a+rX "$release"
  activate "$image" "$release" 'ТЕСТОВАЯ ВЕРСИЯ'
  save_state test-image "$image"
  save_state test-web "$release"
  save_state test-source "$source"
  save_state test-worktree "$worktree"
  finish_activation 'ТЕСТОВАЯ ВЕРСИЯ'
}

show_status() {
  local current web
  current=$(container_image)
  web=$(readlink -f "$WEB/current")
  if [[ ! -f "$STATE/initialized" ]]; then
    printf 'Переключатель ещё не создавал снимок оригинала.\n'
  elif [[ "$current" == "$(read_state original-image-id)" ]] && [[ "$web" == "$(read_state original-web)" || "$web" == "$(read_state original-live-web)" ]]; then
    printf 'Активна: ОРИГИНАЛЬНАЯ ВЕРСИЯ\n'
  elif [[ -f "$STATE/test-image" && -f "$STATE/test-web" ]] && [[ "$current" == "$(image_id "$(read_state test-image)")" && "$web" == "$(read_state test-web)" ]]; then
    printf 'Активна: ТЕСТОВАЯ ВЕРСИЯ\nКоммит: %s\n' "$(read_state test-source)"
  else
    printf 'Активна другая или смешанная сборка; сохранённые снимки не перезаписаны.\n'
  fi
  printf 'Backend: %s\nИнтерфейс: %s\nАдрес: %s\n' "$current" "$web" "$DOMAIN"
}

case "$MODE" in
  status) show_status ;;
  deploy) deploy_test ;;
  test)
    if [[ -f "$STATE/test-image" && -f "$STATE/test-web" ]]; then
      activate "$(read_state test-image)" "$(read_state test-web)" 'ТЕСТОВАЯ ВЕРСИЯ'
      finish_activation 'ТЕСТОВАЯ ВЕРСИЯ'
    else
      deploy_test
    fi
    ;;
  original)
    [[ -f "$STATE/initialized" ]] || die 'Снимок оригинала ещё не создан'
    activate "$(read_state original-image)" "$(read_state original-web)" 'ОРИГИНАЛЬНАЯ ВЕРСИЯ'
    finish_activation 'ОРИГИНАЛЬНАЯ ВЕРСИЯ'
    ;;
esac
