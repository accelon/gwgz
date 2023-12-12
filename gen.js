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

const parseWiki=raw=>{
    //drop header
    const at=raw.indexOf('\n}}');
    raw=raw.slice(at+3)

    let s=raw.replace(/\n /g,'\n^editor').replace(/\n　　/g,'^ck0').replace(/\n/g,'');
    let f=0,n=0;
    const notes=[];
    s=s.replace(/ ?\{\{([^\}]+)\}\}/g,(m,note)=>{
        f++;
        note=note.replace('*|','').trim();
        notes.push(f+'\t'+note)
        return ' ^f'+f; //need extra space to force break of continuous chinese 
    })


    s=s.replace(/==([^=]+)==/g,(m,m1)=>{
        ck++;
        return '\n^ck'+ck+'【'+m1.trim()+'】'
    })

    //convert ck0 to ^n1 ^n2 ...
    
    s=s.replace(/\^ck(\d+)/g,(m,m1)=>{
        const num=parseInt(m1);
        if (num==0) {
            n++;
            return '\n^n'+n;
        } else {
            n=0;
            return '^ck'+m1;
        }
    });


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
    
    //combine ak,ck,n1
    s=s.replace(/\^ck(.+)\n\^n(\d+)/g,'^ck$1^n$2\n');
    s=s.replace(/\^ak(.+)\n\^ck/g,'^ak$1^ck');
    
    return [s,notes];
}

const out=[];
let ck=0,ak=0;
for (let i=1;i<=12;i++) {
    const text= readTextContent('raw/juan'+i+'.txt');
    let [off,notes]=parseWiki(text)
    off='^bk'+i+'(卷'+i+')'+off.trim();
    out.push(off)
    notes.unshift('^:<name='+i+' footnote=bk>\tnote')
    writeChanged('off/juan'+i+'.tsv',notes.join('\n'),true)
}

writeChanged('off/gwgz.off',out.join('\n'),true)


