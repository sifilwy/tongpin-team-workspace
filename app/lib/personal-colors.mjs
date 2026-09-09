export const personalPalette = [
  { id: 'purple', name: '紫色', color: '#7564d7', background: '#f2efff', border: '#d9d0fb' },
  { id: 'blue', name: '蓝色', color: '#4178c7', background: '#edf4ff', border: '#cbdcf5' },
  { id: 'teal', name: '青色', color: '#258a86', background: '#eaf8f6', border: '#bfe3dd' },
  { id: 'green', name: '绿色', color: '#588346', background: '#f0f7eb', border: '#d1e4c4' },
  { id: 'amber', name: '黄色', color: '#a77717', background: '#fff8e5', border: '#efdfad' },
  { id: 'orange', name: '橙色', color: '#c47738', background: '#fff2e7', border: '#f0d1b6' },
  { id: 'rose', name: '粉色', color: '#b45e83', background: '#fceff5', border: '#eccada' },
  { id: 'slate', name: '灰蓝', color: '#63738e', background: '#f0f3f8', border: '#d4dce7' },
];
export const categoryPalette = (saved, owner, category) => personalPalette.find(item => item.id === saved?.[owner]?.[category]) || personalPalette[0];
