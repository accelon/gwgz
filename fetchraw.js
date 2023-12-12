import {nodefs,writeChanged} from 'ptk/nodebundle.cjs'
await nodefs;
for (let i=1;i<=12;i++) {
    const resp=await fetch('https://zh.wikisource.org/wiki/古文觀止/卷'+i+'?action=raw');
    const raw=await resp.text();
    writeChanged('raw/juan'+i+'.txt',raw,true)
}
