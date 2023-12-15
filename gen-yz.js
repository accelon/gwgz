import {fromChineseNumber, readTextContent, nodefs,writeChanged,patchBuf} from 'ptk/nodebundle.cjs'
await nodefs;
const maxfile=230 ; //230
const fileprefix='raw/gwgzyz/text';
const Patches={
    222:[['缇骑（tíjì），','缇骑（tíjì）：']],
    141:[['睍睍（xiàn），','睍睍（xiàn）：']]
}
const parseEpub=content=>{
    let s=content.replace(/<p class="zw">/g,'\n^m').replace(/<[^>]+>/g,'').trim();
    return s;
}
let singlecount=0,notecount=0;
const parseEpubWithNote=content=>{
    const footnoteid={};
    let s=content;

    s=content.replace(/\n/g,'').replace(/<a href="text\d+\.html#([^"]+)">(.+?)<\/a>/g,(m,m1,t)=>{
        // if (~t.indexOf('<'))console.log(t)
        let  s= t.replace(/<br\/>/g,"^p");//
        s=s.replace(/。([\u3400-\u9fff]+)：/g,'。^p$1：'); //
        //TODO: 注釋條 嵌入 內文。
        footnoteid[m1.slice(2)]=s;
        return '';
    })
   
    s=s.replace(/html#([a-z_\d]+)" id="([a-z_\d]+)[^>]+>/g,(m,a,c)=>{
        if (footnoteid[c.slice(2)]) {
            return '>^f'+c.slice(2);
        } else {
            console.log('no matching note',c)
        }
    })
    s=s.replace(/\n*/g,'')
    s=s.replace(/\[\d+\]/g,'')
    return [parseEpub(s), footnoteid];
}
const pinnote=(yw,notes,id)=>{
    const wordoccur={};
    const patches=Patches[id]
    const wordnotes={};
    let notegroup=0; //即 ^f 的id
    for (let key in notes) {
        notegroup++;
        let touched=false;
        let  lines=notes[key].split('^p'); 
        for (let i=1;i<lines.length;i++) { //combine with previous line if not a note
            if (!~lines[i].indexOf('：')) {
                lines[i-1]=lines[i-1]+'^p'+lines[i];
                lines[i]='';
            }
        }
        lines=lines.filter(it=>!!it); //保證每行 只有一個「：」

        for (let i=0;i<lines.length;i++) {
            let note=lines[i];
            if (patches) { //處理 漏了 ： 
                for (let i=0;i<patches.length;i++) {
                    const [from,to]=patches[i];
                    note=note.replace(from,to)
                }
                if (note!=notes[key]) {
                    lines[i]=note;
                    touched=true;
                }
            }

            if (~lines[i].indexOf('：')) {
                const parts=lines[i].split('：');
                notecount++;
                if (parts.length!==2) {
                    // if (parts.length==1) 
                    // console.log(parts)
                } else {
                    const [word,def]=parts;
                    const nopinyin=word.replace(/（[a-zA-Z][^）]+）/g,'')
                    if (!wordoccur[nopinyin]) wordoccur[nopinyin]=0;
                    wordoccur[nopinyin]++
                    if (!wordnotes[notegroup]) wordnotes[notegroup]=[];
                    
                    wordnotes[notegroup].push([nopinyin,def,word!==nopinyin?word:'']);
                    singlecount++;
                }
            } else {
                //特殊情況，解釋整句
            }
        }
        if (touched) {
            notes[key]=lines.join('^p');
        }
    }

    const parts=yw.split(/\^f([\d_]+)/);
    const out=[];
    for (let i=0;i<parts.length/2;i++) {
        let text=parts[i*2];
        let noteid=parts[i*2+1];
        const at=(noteid||'').indexOf('_');
        if (~at) noteid=noteid.slice(at+1)
        
        if (!noteid) continue;
        const notes=wordnotes[noteid];
        let replaced=0;
        if (notes) {
            for (let i=0;i<notes.length;i++) {
                const [nopinyin]=notes[i]
                if (wordoccur[nopinyin]==1) {
                    text=text.replace( nopinyin, '^f('+nopinyin+')')
                    notes[i][3]=true
                    replaced++;
                }
            }
            out.push(text)
            if (replaced!==notes.length) {
                out.push('^f'+noteid+' ')
            }
        } else {
            out.push(text)            
            out.push('^f'+noteid+' ')
        }
    }
    return out.join('')
    //試著用wordnotes 找 出文字，再替換為 ^f(詞) 
    
}
const breaksentence=line=>{
    return line.replace(/(。”?)/g,'$1\n')
    .replace(/(.{6}”)(.{5})/g,"$1\n$2")
    .replace(/(.{6})([？！；])(.{5})/g,"$1$2\n$3")
    .replace(/\n([”’]+)/g,'$1\n')   
    .replace(/\n+/g,'\n')
    .trim()
}
const extractEpub=(raw)=>{
    const out={};
    raw=raw.replace(/[\u200b]/g,'')
    let  m=raw.match(/<h2 id="mllj(\d+)">([^<]+)/);
    if (!m) {
        return null;
    }
    // out.id=m[1];
    out.title=m[2]

    m=raw.match(/<span class="h2note">([^<]+)/);
    if (m) out.note=m[1];

    m=raw.match(/<span class="h2author">([^<]+)/);
    if (m) out.author=m[1];

    const parts=raw.split(/<p class="heavy">[^<]+<\/p>/);
    parts.shift();
    if(parts.length!=3) {
        console.log('not 3 parts');
    }

    const [intro,yuanwen,yiwen]=parts; //題解  原文 譯文
    out.intro=parseEpub(intro);
    const [text,notes]=parseEpubWithNote(yuanwen);
    out.yuanwen=text;
    out.notes=notes;
    out.yiwen=parseEpub(yiwen);

    return out;
}
let articlecount=0,i=4;

const ywoff=[],bhoff=[],allnotes=[];
const emitContent=content=>{
    const json=extractEpub(content);
    if (!json) {
        return;
    }
    if (json) {
        articlecount++;
        json.id=articlecount;
    }

    const yw_pinned=pinnote(json.yuanwen,json.notes,json.id);
    const notes=[],notekeys=[];
    const patches=Patches[json.id]
    for (let key in json.notes) {
        let note=json.notes[key];
        notekeys.push(key);
        notes.push(['',note]);
    }
    
    const yuanwen=breaksentence(yw_pinned.replace(/\^f([\d_]+) */g,(m,m1)=>{
        const at=notekeys.indexOf(m1);
        if (!~at) return '^f0'; //error foonote
        notes[at][0]=json.id+'.'+ (at+1);
        return '^f'+(at+1);
    }));

    ywoff.push('^ck'+json.id+'【'+json.title+'】^n1\n'+yuanwen);
    bhoff.push('^ck'+json.id+'【'+json.title+'】^n1\n'+breaksentence(json.yiwen));
    allnotes.push(...notes);
}
while (i<=maxfile) {
    const fn=fileprefix+i.toString().padStart(5,'0')+'.html';
    let  content=readTextContent(fn)
    if (i==13) { // 齐桓公下拜受胙 被  合併到 text0013 ，分割之
        const at=content.indexOf('<h2 id="mllj11">齐桓公下拜受胙');
        emitContent(content.slice(0,at));
        emitContent(content.slice(at));
    } else {
        const yw='<p class="heavy">【原文】</p>'
        if(i==60) { //多了一個 【原文】
            const at=content.lastIndexOf(yw);
            if (~at) {
                content=content.slice(0,at)+content.slice(at+24);//
            }
        } else if (i==101) {
            const at =content.indexOf('<p class="yw">');//少了 【原文】
            if (~at) content=content.slice(0,at)+'\n'+yw+'\n'+content.slice(at);
        }
        emitContent(content);
    }
    i++;
}

writeChanged('off/gwgzyw.off',ywoff.join('\n'),true);
writeChanged('off/gwgzbh.off',bhoff.join('\n'),true);
writeChanged('off/gwgzyw.tsv', allnotes.join('\n'),true)
console.log('allnote',notecount,'singlecount',singlecount)