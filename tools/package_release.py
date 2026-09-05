"""Build a small, allowlisted runtime archive from a clean source checkout."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT=Path(__file__).resolve().parent.parent

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version',default='1.0.0')
    args=parser.parse_args()
    if args.version!='1.0.0':
        parser.error('Update package/document versions before creating another release')
    for command in (['git','diff','--quiet'],['git','diff','--cached','--quiet']):
        subprocess.run(command,cwd=ROOT,check=True)
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    if not (ROOT/'dist/index.html').is_file():
        parser.error('Run npm ci && npm run build first')
    output=ROOT/'.release'
    output.mkdir(exist_ok=True)
    archive=output/f'hermes-kiosk-dashboard-v{args.version}.tar.gz'
    files=[*sorted((ROOT/'dist').rglob('*')),ROOT/'server/hub.py',ROOT/'server/test_hub.py',ROOT/'deploy/hermes-kiosk-dashboard.service',ROOT/'README.md',ROOT/'HERMES_HANDOFF.md',ROOT/'THIRD_PARTY_NOTICES.md',ROOT/'docs/API_CONTRACT.md',ROOT/'docs/SOURCES.md']
    with tarfile.open(archive,'w:gz') as tar:
        for file in files:
            if file.is_file():
                if file.suffix in {'.env','.log','.pem','.key'}:
                    raise ValueError('Unexpected runtime file')
                tar.add(file,arcname=file.relative_to(ROOT),recursive=False)
        build=json.dumps({'version':args.version,'commit':commit,'python':'3.11+ stdlib only','viewport':'400x1280 portrait','port':9121},indent=2).encode()
        info=tarfile.TarInfo('BUILD_INFO.json');info.size=len(build);info.mode=0o644
        tar.addfile(info,io.BytesIO(build))
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    (output/'SHA256SUMS').write_text(f'{digest}  {archive.name}\n',encoding='utf-8')
    print(f'{archive.name}\ncommit {commit}\nsha256 {digest}')

if __name__=='__main__':main()
