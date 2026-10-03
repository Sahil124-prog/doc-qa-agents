import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 150,
});

export async function loadAndSplitPdf(
  filePath,
  { documentId, userId, fileName },
) {
  const loader = new PDFLoader(filePath);
  const pages = await loader.load();

  const cleanPages = pages
    .filter((page) => page.pageContent.trim().length > 0)
    .map(
      (page) =>
        new Document({
          pageContent: page.pageContent,
          metadata: {
            documentId,
            userId,
            fileName,
            pageNumber: page.metadata.loc.pageNumber,
          },
        }),
    );

  const chunks = await splitter.splitDocuments(cleanPages);

  return { pageCount: pages.length, chunks };
}
