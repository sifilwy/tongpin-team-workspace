export type View = "overview" | "timeline" | "review" | "personal";
export type Status = "待完成" | "进行中" | "已完成";
export type Category = "运营" | "销售" | "交付";
export type Review = { id: number; author: string; text: string; createdAt: string };
export type TaskNote = { id: number; author: string; text: string; createdAt: string };
export type Task = {
  id: number;
  title: string;
  owner: string;
  category: Category;
  due: string;
  status: Status;
  description: string;
  notionUrl?: string;
  completedAt?: string;
  completedBy?: string;
  amount?: number;
  amountRecipient?: string;
  deliverable?: string;
  reviews: Review[];
  notes?: TaskNote[];
};
export type Message = { id: number; author: string; text: string; createdAt: string };

export const NOTION_COLLAB_URL = "https://app.notion.com/p/3c6887634cc4819e8238f4f69454742f?pvs=204";

export const members = [
  { name: "xzx", role: "运营跟进", color: "#d99b39" },
  { name: "吃吃", role: "内容与交付", color: "#e8795c" },
  { name: "czl", role: "销售与设计", color: "#2f9b8f" },
  { name: "子涵", role: "客户支持", color: "#5488d7" },
  { name: "悦悦", role: "团队统筹", color: "#6c5ce7" },
];

export const categories: Category[] = ["运营", "销售", "交付"];
