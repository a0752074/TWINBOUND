import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
globalThis.fetch=async url=>new Response(await readFile(fileURLToPath(url)));
globalThis.self={postMessage:data=>parentPort.postMessage(data)};
await import(workerData.entry);
parentPort.on('message',data=>self.onmessage({data}));
