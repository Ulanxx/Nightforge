import { z } from "zod";
import type { Permission } from "@/lib/policy/policy-engine";

const permissionSchema = z.custom<Permission>((value) => {
  return typeof value === "string";
});

export const createTaskRequestSchema = z.object({
  sessionId: z.string().trim().optional(),
  message: z.string().trim().min(1, "消息不能为空。"),
  permissions: z.array(permissionSchema).default([])
});

export const taskReplyRequestSchema = z.object({
  message: z.string().trim().min(1, "回复内容不能为空。")
});

export const internalTaskRunRequestSchema = z.object({
  sessionId: z.string().trim().min(1, "缺少 sessionId。"),
  taskId: z.string().trim().min(1, "缺少 taskId。"),
  message: z.string().trim().min(1, "缺少 message。"),
  permissions: z.array(permissionSchema).default([])
});

export const internalTaskReplyRequestSchema = z.object({
  sessionId: z.string().trim().min(1, "缺少 sessionId。"),
  taskId: z.string().trim().min(1, "缺少 taskId。"),
  originalPrompt: z.string().trim().min(1, "缺少 originalPrompt。"),
  message: z.string().trim().min(1, "缺少 message。")
});
