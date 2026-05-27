export const FlagTH = ({ size = 1 }) => (
  <span style={{
    display: 'inline-block', width: 28 * size, height: 18 * size,
    borderRadius: 3 * size, overflow: 'hidden', flexShrink: 0,
    background: 'linear-gradient(to bottom,#A51931 20%,#F4F5F8 20%,#F4F5F8 33%,#2E3192 33%,#2E3192 67%,#F4F5F8 67%,#F4F5F8 80%,#A51931 80%)',
  }} />
);

export const FlagGB = ({ size = 1 }) => (
  <span style={{ display: 'inline-block', position: 'relative', width: 28 * size, height: 18 * size, borderRadius: 3 * size, overflow: 'hidden', flexShrink: 0 }}>
    <span style={{ position: 'absolute', inset: 0, background: '#012169' }} />
    <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right,transparent calc(50% - 2px),#fff calc(50% - 2px),#fff calc(50% + 2px),transparent calc(50% + 2px)),linear-gradient(to bottom left,transparent calc(50% - 2px),#fff calc(50% - 2px),#fff calc(50% + 2px),transparent calc(50% + 2px))' }} />
    <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right,transparent calc(50% - 1.5px),#C8102E calc(50% - 1.5px),#C8102E calc(50% + 1.5px),transparent calc(50% + 1.5px)),linear-gradient(to bottom left,transparent calc(50% - 1.5px),#C8102E calc(50% - 1.5px),#C8102E calc(50% + 1.5px),transparent calc(50% + 1.5px))' }} />
    <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '22%', background: '#fff' }} />
    <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: '28%', background: '#fff' }} />
    <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '13%', background: '#C8102E' }} />
    <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: '16%', background: '#C8102E' }} />
  </span>
);

export const FlagMM = ({ size = 1 }) => (
  <span style={{ display: 'inline-block', position: 'relative', width: 28 * size, height: 18 * size, borderRadius: 3 * size, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(to bottom,#FECB00 33.33%,#34B233 33.33%,#34B233 66.67%,#EA2839 66.67%)' }}>
    <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'white', fontSize: 11 * size, lineHeight: 1, userSelect: 'none' }}>★</span>
  </span>
);

export const FLAGS = { th: FlagTH, en: FlagGB, my: FlagMM };
