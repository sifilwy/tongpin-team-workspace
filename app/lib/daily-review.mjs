export const dailyReviewKey = member => `tongpin-daily-review-v1:${member}`;
export const isDailyReviewKey = key => typeof key === 'string' && /^tongpin-daily-review-v1:(xzx|吃吃|czl|子涵|悦悦)$/.test(key);
export const validDailyReview = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length<=5000 && Object.entries(value).every(([date,text])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date&&typeof text==='string'&&text.length<=10000);
