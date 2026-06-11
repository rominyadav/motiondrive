import { useState, useRef, FormEvent } from "react";
import { getDownloadUrl, getSharedDownloadUrl } from "@/app/actions/drive";

interface UseDriveEditorsParams {
  explorerMode: "personal" | "shared" | "archive" | "links";
  currentFolderId: string | null;
  sharedFolderPath: string[];
  showToast: (msg: string, type?: "info" | "success" | "error") => void;
  uploadSingleFile: (
    file: File, 
    targetFolderId: string | null, 
    customPrefix?: string, 
    existingAssetId?: string | null, 
    existingR2Key?: string | null
  ) => Promise<any>;
  refreshExplorerContents: () => Promise<void>;
  setUploadActive: (active: boolean) => void;
}

export function useDriveEditors({
  explorerMode,
  currentFolderId,
  sharedFolderPath,
  showToast,
  uploadSingleFile,
  refreshExplorerContents,
  setUploadActive
}: UseDriveEditorsParams) {
  // Text File Editor State
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textFileName, setTextFileName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textEditorMode, setTextEditorMode] = useState<"create" | "edit">("create");
  const [textEditorAsset, setTextEditorAsset] = useState<any | null>(null);

  // Docs Editor State (Quill)
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docsEditorMode, setDocsEditorMode] = useState<"create" | "edit">("create");
  const [docsEditorAsset, setDocsEditorAsset] = useState<any | null>(null);

  // Blank Sheet Editor State
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [sheetCells, setSheetCells] = useState<{ [key: string]: string }>({});
  const [sheetEditorMode, setSheetEditorMode] = useState<"create" | "edit">("create");
  const [sheetEditorAsset, setSheetEditorAsset] = useState<any | null>(null);

  const [isSavingTextFile, setIsSavingTextFile] = useState(false);
  const [isSavingDocsFile, setIsSavingDocsFile] = useState(false);
  const [isSavingSheetFile, setIsSavingSheetFile] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);

  const handleOpenTextCreator = () => {
    setTextFileName("Untitled.txt");
    setTextContent("");
    setTextEditorMode("create");
    setTextEditorAsset(null);
    setTextModalOpen(true);
  };

  const handleOpenTextEditor = async (asset: any) => {
    try {
      setTextFileName(asset.filename);
      setTextEditorMode("edit");
      setTextEditorAsset(asset);
      setTextModalOpen(true);

      const isShared = explorerMode === "shared";
      const downloadResult = isShared 
        ? await getSharedDownloadUrl(asset.id) 
        : await getDownloadUrl(asset.id);

      const res = await fetch(downloadResult.downloadUrl);
      if (res.ok) {
        const text = await res.text();
        setTextContent(text);
      }
    } catch (err) {
      console.error("Failed to load text file content", err);
    }
  };

  const handleSaveTextFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!textFileName.trim()) return;

    setIsSavingTextFile(true);
    setUploadActive(true);

    try {
      const file = new (window as any).File([textContent], textFileName, { type: "text/plain" });
      
      const isShared = explorerMode === "shared";
      const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      if (textEditorMode === "edit" && textEditorAsset) {
        await uploadSingleFile(
          file, 
          textEditorAsset.folderId, 
          prefix, 
          textEditorAsset.id, 
          textEditorAsset.r2Key
        );
      } else {
        await uploadSingleFile(file, currentFolderId, prefix);
      }

      await refreshExplorerContents();
      showToast("Text file saved successfully!", "success");
      setTextModalOpen(false);
    } catch (err) {
      showToast("Failed to save text file", "error");
    } finally {
      setIsSavingTextFile(false);
    }
  };

  const handleOpenDocsCreator = () => {
    setDocTitle("Untitled Document");
    setDocsEditorMode("create");
    setDocsEditorAsset(null);
    setDocsModalOpen(true);
  };

  const handleOpenDocsEditor = async (asset: any) => {
    try {
      setDocTitle(asset.filename.replace(/\.html$/i, ""));
      setDocsEditorMode("edit");
      setDocsEditorAsset(asset);
      setDocsModalOpen(true);

      const isShared = explorerMode === "shared";
      const downloadResult = isShared 
        ? await getSharedDownloadUrl(asset.id) 
        : await getDownloadUrl(asset.id);

      const res = await fetch(downloadResult.downloadUrl);
      if (res.ok) {
        const rawHtml = await res.text();
        
        setTimeout(() => {
          if (quillRef.current) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, "text/html");
            const qlEditor = doc.querySelector(".ql-editor");
            const content = qlEditor ? qlEditor.innerHTML : doc.body.innerHTML;
            quillRef.current.root.innerHTML = content;
          }
        }, 300);
      }
    } catch (err) {
      console.error("Failed to load document content", err);
    }
  };

  const handleSaveDocsFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !quillRef.current) return;

    setIsSavingDocsFile(true);
    setUploadActive(true);

    try {
      const htmlContent = quillRef.current.root.innerHTML;
      const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css">
  <style>
    body { padding: 32px; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; max-width: 800px; margin: 0 auto; }
    .ql-editor { font-size: 16px; line-height: 1.6; }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff; color: #0f172a; }
    }
  </style>
</head>
<body>
  <div class="ql-container ql-snow">
    <div class="ql-editor">
      ${htmlContent}
    </div>
  </div>
</body>
</html>`;

      const filename = docTitle.toLowerCase().endsWith(".html") ? docTitle : `${docTitle}.html`;
      const file = new (window as any).File([fullHTML], filename, { type: "text/html" });

      const isShared = explorerMode === "shared";
      const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      if (docsEditorMode === "edit" && docsEditorAsset) {
        await uploadSingleFile(
          file, 
          docsEditorAsset.folderId, 
          prefix, 
          docsEditorAsset.id, 
          docsEditorAsset.r2Key
        );
      } else {
        await uploadSingleFile(file, currentFolderId, prefix);
      }

      await refreshExplorerContents();
      showToast("Document saved successfully!", "success");
      setDocsModalOpen(false);
    } catch (err) {
      showToast("Failed to save Document", "error");
    } finally {
      setIsSavingDocsFile(false);
    }
  };

  const columnsList = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rowsCount = 20;

  const handleOpenSheetCreator = () => {
    setSheetName("Untitled Sheet");
    setSheetCells({});
    setSheetEditorMode("create");
    setSheetEditorAsset(null);
    setSheetModalOpen(true);
  };

  const handleOpenSheetEditor = async (asset: any) => {
    try {
      setSheetName(asset.filename.replace(/\.sheet\.json$/i, ""));
      setSheetEditorMode("edit");
      setSheetEditorAsset(asset);
      setSheetModalOpen(true);

      const isShared = explorerMode === "shared";
      const downloadResult = isShared 
        ? await getSharedDownloadUrl(asset.id) 
        : await getDownloadUrl(asset.id);

      const res = await fetch(downloadResult.downloadUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.cells) {
          setSheetCells(data.cells);
        }
      }
    } catch (err) {
      console.error("Failed to load spreadsheet content", err);
    }
  };

  const handleSaveSheetFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!sheetName.trim()) return;

    setIsSavingSheetFile(true);
    setUploadActive(true);

    try {
      const sheetData = {
        columns: columnsList,
        rowsCount: rowsCount,
        cells: sheetCells
      };

      const filename = sheetName.toLowerCase().endsWith(".sheet.json") 
        ? sheetName 
        : `${sheetName}.sheet.json`;

      const file = new (window as any).File([JSON.stringify(sheetData, null, 2)], filename, { type: "application/json" });

      const isShared = explorerMode === "shared";
      const prefix = isShared ? (sharedFolderPath.length > 0 ? sharedFolderPath.join("/") + "/" : "") : "";

      if (sheetEditorMode === "edit" && sheetEditorAsset) {
        await uploadSingleFile(
          file, 
          sheetEditorAsset.folderId, 
          prefix, 
          sheetEditorAsset.id, 
          sheetEditorAsset.r2Key
        );
      } else {
        await uploadSingleFile(file, currentFolderId, prefix);
      }

      await refreshExplorerContents();
      showToast("Sheet saved successfully!", "success");
      setSheetModalOpen(false);
    } catch (err) {
      showToast("Failed to save Sheet", "error");
    } finally {
      setIsSavingSheetFile(false);
    }
  };

  return {
    textModalOpen,
    setTextModalOpen,
    textFileName,
    setTextFileName,
    textContent,
    setTextContent,
    textEditorMode,
    textEditorAsset,
    docsModalOpen,
    setDocsModalOpen,
    docTitle,
    setDocTitle,
    docsEditorMode,
    docsEditorAsset,
    sheetModalOpen,
    setSheetModalOpen,
    sheetName,
    setSheetName,
    sheetCells,
    setSheetCells,
    sheetEditorMode,
    sheetEditorAsset,
    isSavingTextFile,
    isSavingDocsFile,
    isSavingSheetFile,
    editorContainerRef,
    quillRef,
    handleOpenTextCreator,
    handleOpenTextEditor,
    handleSaveTextFile,
    handleOpenDocsCreator,
    handleOpenDocsEditor,
    handleSaveDocsFile,
    handleOpenSheetCreator,
    handleOpenSheetEditor,
    handleSaveSheetFile
  };
}
