export const PERSONALITY_KEY = 'tongpin-personality-xzx-v1';
export const emptyPersonality = () => ({ vision: '', practice: '', entries: [] });
export function validPersonality(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  if (Object.keys(value).some(key => !['vision','practice','entries'].includes(key))) return false;
  if (![value.vision,value.practice].every(text => typeof text === 'string' && text.length <= 10000)) return false;
  if (!Array.isArray(value.entries) || value.entries.length > 1000) return false;
  const ids = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || ids.has(entry.id)) return false;
    ids.add(entry.id);
    if (Object.keys(entry).some(key => !['id','date','action','reflection'].includes(key))) return false;
    if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(Date.parse(entry.date+'T00:00:00Z')) || new Date(entry.date+'T00:00:00Z').toISOString().slice(0,10) !== entry.date) return false;
    if (![entry.action,entry.reflection].every(text => typeof text === 'string' && text.length <= 10000) || !(entry.action.trim() || entry.reflection.trim())) return false;
  }
  return true;
}
