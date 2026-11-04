#!/usr/bin/env python3
"""Offline deployment regression: real Git/worktrees, simulated Docker and health."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile

SWITCHER = Path(__file__).with_name('server-version.sh').resolve()

DOCKER = r'''#!/usr/bin/env python3
import hashlib,json,os,pathlib,sys
p=pathlib.Path(os.environ['MOCK_DOCKER_STATE']);s=json.loads(p.read_text());a=sys.argv[1:]
s.setdefault('calls',[]).append(a)
def save(): p.write_text(json.dumps(s))
def image(ref): return ref if ref.startswith('sha256:') else s['images'][ref]
if a[0]=='info': save();sys.exit(0)
if a[0]=='inspect':
 name=a[1];fmt=a[a.index('--format')+1]
 if 'com.docker.compose.project' in fmt: print('battleship')
 elif 'com.docker.compose.service' in fmt: print('db' if name=='battleship-db' else 'backend')
 elif fmt=='{{.Image}}': print(s['active'])
 else: raise RuntimeError(fmt)
 save();sys.exit(0)
if a[:2]==['image','inspect']: print(image(a[2]));save();sys.exit(0)
if a[:2]==['image','tag']: s['images'][a[3]]=image(a[2]);save();sys.exit(0)
if a[0]=='exec':
 assert a[1]=='battleship-db' and a[2]=='pg_dump'
 print('-- Offline fixture dump\nSELECT 1;');save();sys.exit(0)
if a[0]=='run':
 tree=pathlib.Path(a[a.index('-v')+1].split(':')[0]);out=tree/'frontend/dist';(out/'assets').mkdir(parents=True)
 (out/'index.html').write_text('<html>test build</html>');(out/'assets/app.js').write_text('console.log(1)')
 save();sys.exit(0)
if a[0]=='compose':
 files=[pathlib.Path(a[i+1]) for i,x in enumerate(a) if x=='-f']
 if 'config' in a:
  if '--format' in a: print(files[0].read_text())
  else:
   assert json.loads(files[0].read_text())['services']['backend']['container_name']=='battleship-backend'
  save();sys.exit(0)
 override=json.loads(files[-1].read_text())['services']['backend']
 if 'build' in a:
  fail=p.parent/'fail-build-once'
  if fail.exists(): fail.unlink();save();sys.exit(9)
  tree=pathlib.Path(override['build']['context'])
  assert (tree/'server-patch').read_text()=='preserved\n'
  assert (tree/'frontend/version').read_text()=='design\n'
  s['builds']=s.get('builds',0)+1
  s['images'][override['image']]='sha256:'+hashlib.sha256(override['image'].encode()).hexdigest()
 elif 'up' in a:
  assert a[-1]=='backend' and '--no-deps' in a and '--no-build' in a
  s['active']=image(override['image']);s['unhealthy']=False
  fail=p.parent/'fail-health-once'
  if fail.exists() and ':preview-' in override['image']:
   fail.unlink();s['unhealthy']=True
 else: raise RuntimeError(a)
 save();sys.exit(0)
raise RuntimeError(a)
'''

CURL = r'''#!/usr/bin/env python3
import json,os,pathlib,sys
s=json.loads(pathlib.Path(os.environ['MOCK_DOCKER_STATE']).read_text())
if s.get('unhealthy'): sys.exit(22)
print('{"ok":true}')
'''


def run(args, cwd=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True)


with tempfile.TemporaryDirectory(prefix='battleship-switch-test-') as tmp:
    base = Path(tmp)
    origin, seed, root = [base / p for p in ['origin.git', 'seed', 'server']]
    run(['git', 'init', '--bare', '--initial-branch=main', str(origin)])
    run(['git', 'init', '--initial-branch=main', str(seed)])
    for repo in [seed]:
        run(['git', 'config', 'user.name', 'Test'], repo)
        run(['git', 'config', 'user.email', 'test@localhost'], repo)
    (seed / 'frontend').mkdir()
    (seed / 'frontend/version').write_text('original\n')
    (seed / '.gitignore').write_text('frontend/dist/\n')
    run(['git', 'add', '.'], seed)
    run(['git', 'commit', '-m', 'Original'], seed)
    run(['git', 'remote', 'add', 'origin', str(origin)], seed)
    run(['git', 'push', 'origin', 'main'], seed)
    run(['git', 'switch', '-c', 'design/naval-home'], seed)
    (seed / 'frontend/version').write_text('design\n')
    run(['git', 'commit', '-am', 'Design'], seed)
    run(['git', 'push', 'origin', 'design/naval-home'], seed)
    run(['git', 'clone', '--single-branch', '--branch', 'main', str(origin), str(root)])
    run(['git', 'config', 'user.name', 'Test'], root)
    run(['git', 'config', 'user.email', 'test@localhost'], root)
    run(['git', 'switch', '-c', 'hostkey'], root)
    deploy = root / 'deploy-hostkey'
    deploy.mkdir()
    (deploy / 'backend.Dockerfile').write_text('FROM scratch\n')
    config = {
        'name': 'battleship',
        'services': {
            'backend': {'container_name': 'battleship-backend', 'image': 'battleship-backend:latest',
                        'build': {'context': str(root), 'dockerfile': 'deploy-hostkey/backend.Dockerfile'},
                        'environment': {'JWT_SECRET': 'PRIVATE_TEST_VALUE'}},
            'db': {'container_name': 'battleship-db', 'image': 'postgres:16-alpine',
                   'environment': {'POSTGRES_USER': 'battleship', 'POSTGRES_DB': 'battleship', 'POSTGRES_PASSWORD': 'PRIVATE_TEST_VALUE'},
                   'volumes': [{'type': 'volume', 'source': 'battleship_pgdata', 'target': '/var/lib/postgresql/data'}]},
        },
    }
    (deploy / 'docker-compose.yml').write_text(json.dumps(config))
    (root / 'server-patch').write_text('preserved\n')
    run(['git', 'add', '.'], root)
    run(['git', 'commit', '-m', 'Server patches'], root)
    original_commit = run(['git', 'rev-parse', 'HEAD'], root).stdout.strip()
    web = base / 'www'
    live = web / 'releases/live'
    live.mkdir(parents=True)
    (live / 'index.html').write_text('original front')
    (web / 'current').symlink_to(live)
    state = base / 'private-state'
    docker_state = base / 'docker-state.json'
    original_id = 'sha256:' + '1' * 64
    docker_state.write_text(json.dumps({'active': original_id, 'images': {'battleship-backend:latest': original_id}}))
    binaries = base / 'bin'
    binaries.mkdir()
    for name, content in [('docker', DOCKER), ('curl', CURL)]:
        path = binaries / name
        path.write_text(content)
        path.chmod(0o755)
    env = dict(os.environ, PATH=str(binaries) + os.pathsep + os.environ['PATH'],
               BATTLESHIP_ROOT=str(root), BATTLESHIP_WEBROOT=str(web), BATTLESHIP_SWITCH_STATE=str(state),
               BATTLESHIP_DOMAIN='https://test.invalid', BATTLESHIP_HEALTH_ATTEMPTS='2', BATTLESHIP_HEALTH_INTERVAL='0',
               MOCK_DOCKER_STATE=str(docker_state))

    def switch(mode, success=True):
        result = subprocess.run(['bash', str(SWITCHER), mode], env=env, text=True, capture_output=True)
        assert (result.returncode == 0) == success, result.stdout + result.stderr
        assert 'PRIVATE_TEST_VALUE' not in result.stdout + result.stderr
        assert run(['git', 'rev-parse', 'HEAD'], root).stdout.strip() == original_commit
        assert run(['git', 'branch', '--show-current'], root).stdout.strip() == 'hostkey'
        return result

    (root / 'server-patch').write_text('uncommitted\n')
    switch('test', False)
    assert json.loads(docker_state.read_text())['active'] == original_id
    (root / 'server-patch').write_text('preserved\n')
    print('Dirty checkout rejected before activation: pass', flush=True)

    switch('test')
    test_front = (web / 'current').resolve()
    test_image = json.loads(docker_state.read_text())['active']
    assert test_image != original_id and (test_front / 'index.html').read_text() == '<html>test build</html>'
    assert stat.S_IMODE(state.stat().st_mode) == 0o700
    assert stat.S_IMODE((state / 'original-compose.yml').stat().st_mode) == 0o600
    assert (state / 'original-compose.yml').read_bytes() == (deploy / 'docker-compose.yml').read_bytes()
    assert not (state / 'original-compose.json.tmp').exists()
    assert list((state / 'backups').glob('*.sql.gz'))
    assert (test_front / 'index.html').stat().st_mode & stat.S_IROTH
    assert (Path((state / 'test-worktree').read_text().strip()) / 'server-patch').read_text() == 'preserved\n'
    print('Separate worktree preserves patches, pins image, backs up DB, protects secrets and serves readable assets: pass', flush=True)

    shutil.rmtree(live)
    switch('original')
    assert json.loads(docker_state.read_text())['active'] == original_id
    assert (web / 'current').resolve() != live
    assert ((web / 'current') / 'index.html').read_text() == 'original front'
    before_builds = json.loads(docker_state.read_text())['builds']
    switch('test')
    assert json.loads(docker_state.read_text())['active'] == test_image
    assert json.loads(docker_state.read_text())['builds'] == before_builds
    assert (web / 'current').resolve() == test_front
    switch('original')
    print('Original survives release deletion; original/test switch reuses pinned builds: pass', flush=True)

    (base / 'fail-health-once').touch()
    failed = switch('deploy', False)
    assert json.loads(docker_state.read_text())['active'] == original_id
    assert ((web / 'current') / 'index.html').read_text() == 'original front'
    assert 'восстановлена' in failed.stderr
    assert (state / 'test-web').read_text().strip() == str(test_front)
    print('Unhealthy candidate restores previous backend/front without overwriting the successful test snapshot: pass', flush=True)

    (base / 'fail-build-once').touch()
    switch('deploy', False)
    assert json.loads(docker_state.read_text())['active'] == original_id
    assert ((web / 'current') / 'index.html').read_text() == 'original front'
    calls = json.loads(docker_state.read_text())['calls']
    assert not any('down' in c or 'prune' in c for c in calls)
    assert all(c[-1] == 'backend' and '--no-deps' in c for c in calls if c[0] == 'compose' and 'up' in c)
    print('Build failure leaves live version intact; no database restart, compose down or volume deletion: pass', flush=True)
