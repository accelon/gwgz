import {fromChineseNumber, readTextContent, nodefs,writeChanged} from 'ptk/nodebundle.cjs'
await nodefs;
const aktypes={
    1:'周',
    4:'秦',
    5:'周',
    7:'唐',
    10:'宋',
    12:'明',
}

const parseChunk=(s,notes,ckid)=>{
    //convert ck0 to ^n1 ^n2 ...
    let n=0;
    s=s.replace(/\^nn/g,(m,m1)=>{
        const num=parseInt(m1);
        n++;
        return '\n^n'+n;
    });

    let f=0;
    s=s.replace(/ ?\{\{([^\}]+)\}\}/g,(m,note)=>{
        f++;
        note=note.replace('*|','').trim();
        notes.push(ckid+'.'+f+'\t'+note)
        return ' ^f'+f; //need extra space to force break of continuous chinese 
    })


    s=s.replace(/=([^=]+)=/g,(m,m1)=>{
        m1=m1.trim();
        m1=m1.match(/卷(.{1,2})/);
        const n=fromChineseNumber(m1[1])
        if (aktypes[n]) {
            ak++;
            return '^ak'+ak+'【'+aktypes[n]+'】';
        }
        return '';
        //'\n^ak'+m1
    })
    s=s.replace(/([。？])([^\u3400-\u9fff]*)/g,'$1$2\n')
    s=s.replace(/([「《【])\n/g,'\n$1');
    s=s.replace(/\^n(\d+)\n/g,'^n$1');
    s=s.replace(/\^editor\n/g,'\n編按：');
    s=s.replace(/\n([【])/g,'$1');
    s=s.replace(/『\n/g,'\n『');
    //no need space, punc can break the cjk word
    s=s.replace(/([\d。，、」』】》？]) \^f/g,'$1^f')
    

    return s;
}
const parseWiki=raw=>{
    //drop header
    const at=raw.indexOf('\n}}');
    raw=raw.slice(at+3)

    let s=raw.replace(/\n /g,'\n^editor').replace(/\n　　/g,'^nn').replace(/\n/g,'');

    s=s.replace(/==([^=]+)==/g,(m,m1)=>{
        ck++;
        return '\n^ck'+ck+'【'+m1.trim()+'】'
    })

    const chunks=s.split(/(\^ck\d+)/);
    const out=[],notes=[];
    const first=chunks.shift();
    chunks[0]=chunks[0]+first;
    
    for (let j=0;j<chunks.length/2;j++) {
        const ckid=chunks[j*2].match(/ck(\d+)/)[1];
        out.push( parseChunk(chunks[j*2]+chunks[j*2+1], notes,ckid));
    }
    
    s=out.join('\n')

    //combine ak,ck,n1
    s=s.replace(/\^ck(.+)\n\^n(\d+)/g,'^ck$1^n$2\n');
    s=s.replace(/\^ak(.+)\n\^ck/g,'^ak$1^ck');
    return [s,notes];
}

const out=[],notes=[];
let ck=0,ak=0;
for (let i=1;i<=12;i++) {
    const text= readTextContent('raw/juan'+i+'.txt');
    let [off,_notes]=parseWiki(text)
    off='^juan'+i+'(卷'+i+')'+off.trim();
    out.push(off);
    notes.push(..._notes);
}
notes.unshift('^:<name=gwgz footnote=ck nocheck=true>\tnote'); /// ck resets ^f , nocheck is needed
writeChanged('off/gwgz.tsv',notes.join('\n'),true)
out[0]='^bk#gwgz【古文觀止】'+out[0];
out.push('^ck223');//end marker
writeChanged('off/gwgz.off',out.join('\n'),true)


