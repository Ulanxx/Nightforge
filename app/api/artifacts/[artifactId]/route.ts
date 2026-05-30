import { NextResponse } from "next/server";
import { prisma } from "@/lib/store/prisma";
import { readArtifactContent } from "@/lib/agent/web-input";

export async function GET(_: Request, context: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await context.params;
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId }
  });

  if (!artifact) {
    return NextResponse.json({ error: "未找到产物。" }, { status: 404 });
  }

  const content = await readArtifactContent(artifact.storagePath);

  return new NextResponse(content, {
    headers: {
      "Content-Type": artifact.mimeType ?? "text/plain; charset=utf-8"
    }
  });
}
