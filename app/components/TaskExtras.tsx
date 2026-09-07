"use client";
import { useState } from "react";
import { members } from "../lib/model";
import { taskTotal } from "../lib/task-amount.mjs";
import "../task-extras.css";

export function AssistantPicker({ defaultValue = [], value, onChange }: { defaultValue?: string[]; value?: string[]; onChange?: (names: string[]) => void }) {
  const [selected, setSelected] = useState(defaultValue);
  const current = value ?? selected;
  return <fieldset className="task-assistants"><legend>协助人（选填，可多选）</legend><div>{members.map(member => <label key={member.name}><input type="checkbox" name="assistants" value={member.name} checked={current.includes(member.name)} onChange={event => {
    const next = event.target.checked ? [...current, member.name] : current.filter(name => name !== member.name);
    setSelected(next); onChange?.(next);
  }} />{member.name}</label>)}</div><small>仅标注协助，不改变负责人或金额归属。</small></fieldset>;
}

export function BillingFields({ amount, quantity = null, requireQuantity = false }: { amount?: number; quantity?: number | null; requireQuantity?: boolean }) {
  const [price, setPrice] = useState(amount === undefined ? "" : String(amount));
  const [count, setCount] = useState(quantity === null ? "" : String(quantity));
  return <section className="task-billing"><div className="form-row"><label>单次金额（选填）<input name="amount" type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="不填则不计金额" /></label><label>实际产出次数<input name="quantity" type="number" min="0" max="999999" step="1" required={requireQuantity} value={count} onChange={event => setCount(event.target.value)} placeholder="完成后再填" /></label></div><p>合计 <strong>{count === "" ? "待确认" : `¥${taskTotal({ amount: Number(price), quantity: Number(count) }).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`}</strong><span>次数可先留空，完成后按实际产出计入。</span></p></section>;
}
