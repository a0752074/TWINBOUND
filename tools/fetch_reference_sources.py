"""Download cited source snapshots and report whether their recorded hashes match."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'research-sources')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    metadata=json.loads((ROOT/'data/evidence/source-snapshots.json').read_text())
    results=[]
    for source in metadata['sources']:
        name=source['name']
        if Path(name).name!=name:raise ValueError('Invalid source filename')
        try:
            with urllib.request.urlopen(source['url'],timeout=30) as response:data=response.read()
            (args.output/name).write_bytes(data)
            actual=hashlib.sha256(data).hexdigest()
            results.append({'name':name,'url':source['url'],'expectedSHA256':source['sha256'],'observedSHA256':actual,'status':'Matched' if actual==source['sha256'] else 'Source Changed'})
        except Exception as error:results.append({'name':name,'url':source['url'],'status':'Unavailable','error':str(error)})
    (args.output/'download-report.json').write_text(json.dumps(results,indent=2)+'\n')
    for result in results:print(result['name'],result['status'])
if __name__=='__main__':main()
