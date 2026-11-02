"""Wait for I/J/X, submit one CPU audit K, then collect its report.

No GPU reruns, scientific gate evaluation, commits or website publications are
performed by this watcher. A durable journal prevents duplicate submissions.
Usage: python kaggle/watch_md.py [--once] [--hours 12] [--interval 180]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / 'kaggle_runs/md_watch'
STATE_DIR.mkdir(parents=True, exist_ok=True)
STATE = STATE_DIR / 'state.json'
LOCK = STATE_DIR / 'watch.lock'
OWNER = 'phongnguyendinh/'


def now():
    return datetime.now(timezone(timedelta(hours=7))).isoformat(timespec='seconds')


def save(state):
    state['updated_at'] = now()
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    tmp.replace(STATE)


def cli(*args):
    env = dict(os.environ, PYTHONUTF8='1')
    r = subprocess.run([shutil.which('kaggle'), *args], cwd=ROOT, env=env,
                       text=True, encoding='utf-8', errors='replace', capture_output=True,
                       timeout=600, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    with (STATE_DIR / 'commands.log').open('a', encoding='utf-8') as log:
        log.write(f'\n{now()} kaggle {" ".join(args)}\n{r.stdout}\n{r.stderr}\n')
    if r.returncode:
        raise RuntimeError(f'Kaggle command failed ({r.returncode}); see commands.log')
    return r.stdout


def statuses(api, names):
    result = {}
    for name in names:
        response = api.kernels_status(OWNER + f'senguard-msc-{name}')
        result[name] = str(response.status).split('.')[-1].upper()
    return result


def main(args):
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    if args.once:
        print(json.dumps(statuses(api, ('i', 'j', 'x')), indent=2))
        return
    state = json.loads(STATE.read_text()) if STATE.exists() else {'stage': 'waiting', 'started_at': now()}
    if state['stage'] in ('submitting_audit', 'needs_review', 'collected'):
        raise RuntimeError(f"Journal stage is {state['stage']}; inspect state.json before restarting.")
    deadline = time.monotonic() + args.hours * 3600
    failures = 0
    with LOCK.open('x') as f:
        f.write(str(os.getpid()))
    try:
        while time.monotonic() < deadline:
            try:
                names = ('k',) if state['stage'] == 'audit_running' else ('i', 'j', 'x')
                latest = statuses(api, names)
                state['kernels'] = {**state.get('kernels', {}), **latest}
                save(state)
                print(now(), state['stage'], latest, flush=True)
                if any(s in ('ERROR', 'CANCELLED', 'CANCELED') for s in latest.values()):
                    state['stage'] = 'needs_review'
                    state['note'] = 'A kernel failed or was cancelled. No retry or GPU job was submitted.'
                    for name, status in latest.items():
                        if status in ('ERROR', 'CANCELLED', 'CANCELED'):
                            cli('kernels', 'output', OWNER + f'senguard-msc-{name}', '-p',
                                str(STATE_DIR / name), '--file-pattern', r'(run\.log|x\.log|md_audit\.json|done\.txt)$')
                    save(state)
                    return
                if all(s == 'COMPLETE' for s in latest.values()):
                    if state['stage'] == 'audit_running':
                        cli('kernels', 'output', OWNER + 'senguard-msc-k', '-p',
                            str(STATE_DIR / 'k'), '--file-pattern', r'md_audit\.json$')
                        report = json.loads((STATE_DIR / 'k/md_audit.json').read_text())
                        state.update(stage='collected', audit_status=report['status'],
                                     common_duration_ns=report.get('common_duration_ns'),
                                     note='Audit collected. Scientific analysis and website release still require review.')
                        save(state)
                        return
                    # Record intent BEFORE the remote mutation. An interrupted or ambiguous
                    # submission must be inspected, never silently repeated.
                    state['stage'] = 'submitting_audit'
                    save(state)
                    cli('kernels', 'push', '-p', str(ROOT / 'kaggle/senguard-msc-k'))
                    state['stage'] = 'audit_running'
                    save(state)
                failures = 0
            except Exception as error:
                failures += 1
                state['last_error'] = f'{type(error).__name__}: {error}'
                save(state)
                if state['stage'] == 'submitting_audit' or failures >= 3:
                    state['stage'] = 'needs_review'
                    save(state)
                    raise
            time.sleep(args.interval)
        state['note'] = 'Watcher time limit reached; it can be restarted from this journal.'
        save(state)
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--hours', type=float, default=12)
    parser.add_argument('--interval', type=float, default=180)
    main(parser.parse_args())
