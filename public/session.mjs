import {validate} from './engine.mjs';
export const TIME_OPTIONS=[0,30,60,120,43200];
export const QUICK_MESSAGES=['Merhaba!','İyi şanslar!','Güzel hamle!','Düşünüyorum…','Teşekkürler!','Rövanş?'];
export function rebaseDraft(board,hand,draft){if(!draft.length)return [];if(draft.some(p=>!hand.some(t=>t.id===p.id)||board[p.x+','+p.y]))return [];return draft.map(p=>({...p}))}

export function needsChatWarning(text){const words=String(text).normalize("NFKC").toLocaleLowerCase("tr").replace(/[ıİ]/g,"i");return /(?:^|[^a-zçğıöşü])(?:amk|aq|orospu|siktir|sikerim|sikicem|sikecem|piç|pic|fuck|bitch|nigger)(?:$|[^a-zçğıöşü])|seni (?:öldür|oldur)/iu.test(words)}
