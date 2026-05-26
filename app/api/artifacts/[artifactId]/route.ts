import { NextResponse } from "next/server";
import { prisma } from "@/lib/store/prisma";
import { readArtifact } from "@/lib/agent/research";

export async function GET(_: Request, context: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await context.params;
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId }
  });

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  const content = await readArtifact(artifact.storagePath);

  return new NextResponse(content, {
    headers: {
      "Content-Type": artifact.mimeType ?? "text/plain; charset=utf-8"
    }
  });
}
