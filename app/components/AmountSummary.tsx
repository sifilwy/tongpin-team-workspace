"use client";

import { members, Task } from "../lib/model";

const money = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function AmountSummary({ tasks }: { tasks: Task[] }) {
  const completed = tasks.filter((task) => task.status === "已完成" && Number(task.amount) > 0);
  const rows = members.map((member) => {
    const credited = completed.filter((task) => (task.amountRecipient || task.owner) === member.name);
    return {
      ...member,
      total: credited.reduce((sum, task) => sum + (task.amount || 0), 0),
      tasks: credited,
    };
  });
  const total = rows.reduce((sum, member) => sum + member.total, 0);

  return <section className="amount-summary">
    <header className="amount-summary-heading">
      <div><span>已完成任务</span><strong>金额汇总</strong><small>金额在任务完成后自动计入负责人</small></div>
      <div><span>团队累计</span><b>¥{money.format(total)}</b></div>
    </header>
    <div className="amount-member-grid">
      {rows.map((member, index) => <article className={index === 0 ? "leading" : ""} key={member.name}>
        <header><i style={{ background: member.color }}>{member.name[0]}</i><div><strong>{member.name}</strong><span>{member.tasks.length} 项已计金额任务</span></div><b>¥{money.format(member.total)}</b></header>
        {member.tasks.length > 0 && <div className="amount-task-list">{member.tasks.map((task) => <div key={task.id}><span>{task.title}</span><b>¥{money.format(task.amount || 0)}</b></div>)}</div>}
      </article>)}
    </div>
  </section>;
}
