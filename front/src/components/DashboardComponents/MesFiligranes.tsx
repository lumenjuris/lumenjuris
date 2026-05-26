import { useEffect, useRef, useState } from "react";
import { Image, Pencil, Trash2, Upload, X, Check } from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";

interface UploadedImage {
  filename: string;
  displayName: string;
}

export function MesFiligranes() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [renamingFilename, setRenamingFilename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const proxyBase = (import.meta.env.VITE_URL_PROXY as string) ?? "";

  async function fetchImages() {
    try {
      setLoading(true);
      const res = await fetchProxy("/api/user-uploads", {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setImages(data.data.images);
      } else {
        setError(data.message ?? "Erreur lors du chargement.");
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchImages();
  }, []);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadError(null);
    if (file && !uploadName) {
      setUploadName(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleUpload() {
    if (!uploadFile) {
      setUploadError("Veuillez sélectionner une image.");
      return;
    }
    if (!uploadName.trim()) {
      setUploadError("Veuillez saisir un nom d'affichage.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const arrayBuffer = await uploadFile.arrayBuffer();
      const imageBase64 = btoa(
        new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ""),
      );

      const res = await fetchProxy("/api/user-uploads/upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: uploadFile.type,
          displayName: uploadName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUploadFile(null);
        setUploadName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchImages();
      } else {
        setUploadError(data.message ?? "Erreur lors de l'upload.");
      }
    } catch {
      setUploadError("Impossible de contacter le serveur.");
    } finally {
      setUploading(false);
    }
  }

  function startRename(img: UploadedImage) {
    setRenamingFilename(img.filename);
    setRenameValue(img.displayName);
  }

  async function confirmRename(filename: string) {
    if (!renameValue.trim()) return;
    setRenaming(true);
    try {
      const res = await fetchProxy(`/api/user-uploads/${encodeURIComponent(filename)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: renameValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setImages((prev) =>
          prev.map((img) =>
            img.filename === filename ? { ...img, displayName: renameValue.trim() } : img,
          ),
        );
        setRenamingFilename(null);
      }
    } catch {
      // silently ignore
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete(filename: string) {
    setDeletingFilename(filename);
    setDeleting(true);
    try {
      const res = await fetchProxy(`/api/user-uploads/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setImages((prev) => prev.filter((img) => img.filename !== filename));
      }
    } catch {
      // silently ignore
    } finally {
      setDeleting(false);
      setDeletingFilename(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mes filigranes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Importez vos images pour les utiliser comme filigranes sur vos documents générés.
        </p>
      </div>

      {/* Zone d'upload */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Ajouter une image</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Fichier image
            </label>
            <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-lumenjuris transition-colors">
              <Upload className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500 truncate">
                {uploadFile ? uploadFile.name : "Cliquez pour sélectionner…"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                className="hidden"
                onChange={handleFilePick}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Nom d'affichage
            </label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Ex : Logo entreprise"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-lumenjuris transition-colors"
            />
          </div>
        </div>

        {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-2 bg-lumenjuris text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-lumenjuris-dark transition-colors disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Envoi en cours…" : "Importer"}
        </button>
      </div>

      {/* Galerie */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Mes images</h2>

        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
        )}

        {!loading && error && (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        )}

        {!loading && !error && images.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Image className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">Aucune image importée pour l'instant.</p>
          </div>
        )}

        {!loading && !error && images.length > 0 && (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img) => (
              <li
                key={img.filename}
                className="group relative flex flex-col rounded-xl border border-gray-200 overflow-hidden bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <div className="aspect-square flex items-center justify-center bg-gray-100 overflow-hidden">
                  <img
                    src={`${proxyBase}/api/user-uploads/assets/${img.filename}`}
                    alt={img.displayName}
                    className="max-h-full max-w-full object-contain p-2"
                  />
                </div>

                <div className="p-2.5 space-y-2">
                  {renamingFilename === img.filename ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(img.filename);
                          if (e.key === "Escape") setRenamingFilename(null);
                        }}
                        className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-1 outline-none focus:border-lumenjuris min-w-0"
                      />
                      <button
                        onClick={() => confirmRename(img.filename)}
                        disabled={renaming}
                        className="text-lumenjuris hover:text-lumenjuris-dark"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRenamingFilename(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-gray-700 truncate">{img.displayName}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startRename(img)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-lumenjuris transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                      Renommer
                    </button>
                    <button
                      onClick={() => handleDelete(img.filename)}
                      disabled={deleting && deletingFilename === img.filename}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
