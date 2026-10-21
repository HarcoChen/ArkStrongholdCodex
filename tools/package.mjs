import {packageClient} from '@arkstrongholdrl/ark-play-core/build-package';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
console.log(JSON.stringify(await packageClient({kind:'codex',root:fileURLToPath(new URL('../',import.meta.url)),
  sharedRoot:dirname(fileURLToPath(import.meta.resolve('@arkstrongholdrl/ark-play-core/package.json'))),output:process.argv[2]}),null,2));
