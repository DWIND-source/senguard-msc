"""Package the reviewed local audit source as a CPU-only Kaggle notebook."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'senguard_msc/src/audit_md_runs.py').read_text()
dest = ROOT / 'kaggle/senguard-msc-k'
dest.mkdir(parents=True, exist_ok=True)
code = '''import subprocess, sys
from pathlib import Path
subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', 'mdtraj==1.11.2'], check=True)
'''
code += f"source = {source!r}\n"
code += '''Path('/kaggle/working/audit_md_runs.py').write_text(source)
subprocess.run([sys.executable, '/kaggle/working/audit_md_runs.py'], check=True)
'''
compile(code, '<audit notebook>', 'exec')
notebook = {'nbformat': 4, 'nbformat_minor': 5,
            'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
                         'audit_source_sha256': hashlib.sha256(source.encode()).hexdigest()},
            'cells': [{'cell_type': 'markdown', 'metadata': {}, 'id': 'purpose',
                       'source': ['# SenGuard-MSC K: production audit\n',
                                  'Checks all twelve real trajectories before analysis. No MD gate result or website publication is produced here.\n']},
                      {'cell_type': 'code', 'metadata': {}, 'id': 'audit', 'execution_count': None,
                       'outputs': [], 'source': code.splitlines(True)}]}
(dest / 'senguard-msc-k.ipynb').write_text(json.dumps(notebook, indent=1) + '\n')
metadata = {'id': 'phongnguyendinh/senguard-msc-k', 'title': 'SenGuard-MSC K - production audit',
            'code_file': 'senguard-msc-k.ipynb', 'language': 'python', 'kernel_type': 'notebook',
            'is_private': True, 'enable_gpu': False, 'enable_tpu': False, 'enable_internet': True,
            'dataset_sources': [], 'competition_sources': [],
            'kernel_sources': ['phongnguyendinh/senguard-msc-i', 'phongnguyendinh/senguard-msc-j']}
(dest / 'kernel-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Built CPU audit kernel from source', notebook['metadata']['audit_source_sha256'])
