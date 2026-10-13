"use client";
import { useState } from "react";
import { members } from "../lib/model";

import "../task-extras.css";

export function AssistantPicker({ defaultValue = [], value, onChange }: { defaultValue?: string[]; value?: string[]; onChange?: (names: string[]) => void }) {
  const [selected, setSelected] = useState(defaultValue);
  const current = value ?? selected;
  return <fieldset className="task-assistants"><legend>协助人（选填，可多选）</legend><div>{members.map(member => <label key={member.name}><input type="checkbox" name="assistants" value={member.name} checked={current.includes(member.name)} onChange={event => {
    const next = event.target.checked ? [...current, member.name] : current.filter(name => name !== member.name);
    setSelected(next); onChange?.(next);
  }} />{member.name}</label>)}</div><small>仅标注协助，不改变负责人。</small></fieldset>;
}

