import { useState } from "react";
import { Folder, FolderOpen, Plus, Tag as TagIcon, Inbox } from "lucide-react";
import type { FolderDTO, TagDTO } from "./types";

interface Props {
  folders: FolderDTO[];
  tags: TagDTO[];
  activeFolder: string | null;
  activeTags: string[];
  onFolderSelect: (id: string | null) => void;
  onTagToggle: (id: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onCreateTag: (label: string, color: string) => void;
}

const TAG_COLORS = ["#354F99", "#dc2626", "#f59e0b", "#10b981", "#7c3aed", "#0891b2"];

/** Panneau latéral gauche : arborescence de dossiers + tags transverses. */
export function Sidebar({
  folders, tags, activeFolder, activeTags,
  onFolderSelect, onTagToggle, onCreateFolder, onCreateTag,
}: Props) {
  const roots = folders.filter((f) => !f.parentExternalId);
  const childrenOf = (id: string) => folders.filter((f) => f.parentExternalId === id);

  const [newFolder, setNewFolder] = useState("");
  const [newTag, setNewTag] = useState("");

  return (
    <aside className="w-56 shrink-0 space-y-5">
      {/* Dossiers */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Dossiers</p>
        <button
          onClick={() => onFolderSelect(null)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            activeFolder === null ? "bg-[#354F99]/8 text-[#354F99] font-semibold" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Inbox className="w-3.5 h-3.5" /> Tous les contrats
        </button>
        <div className="mt-0.5">
          {roots.map((f) => (
            <FolderNode
              key={f.id} folder={f} depth={0} childrenOf={childrenOf}
              activeFolder={activeFolder} onSelect={onFolderSelect}
            />
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (newFolder.trim()) { onCreateFolder(newFolder.trim(), null); setNewFolder(""); } }}
          className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100"
        >
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="Nouveau dossier"
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-gray-200 outline-none focus:border-gray-300"
          />
          <button type="submit" className="p-1 rounded-md text-gray-400 hover:text-[#354F99] hover:bg-gray-50" title="Créer">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Tags */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && <span className="text-[11px] text-gray-300 px-1">Aucun tag</span>}
          {tags.map((t) => {
            const active = activeTags.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => onTagToggle(t.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-all"
                style={{
                  backgroundColor: active ? t.color : t.color + "18",
                  color: active ? "#fff" : t.color,
                }}
              >
                <TagIcon className="w-2.5 h-2.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (newTag.trim()) { onCreateTag(newTag.trim(), TAG_COLORS[tags.length % TAG_COLORS.length]); setNewTag(""); } }}
          className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100"
        >
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Nouveau tag"
            className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-gray-200 outline-none focus:border-gray-300"
          />
          <button type="submit" className="p-1 rounded-md text-gray-400 hover:text-[#354F99] hover:bg-gray-50" title="Créer">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Nœud récursif de l'arborescence de dossiers. */
function FolderNode({
  folder, depth, childrenOf, activeFolder, onSelect,
}: {
  folder: FolderDTO;
  depth: number;
  childrenOf: (id: string) => FolderDTO[];
  activeFolder: string | null;
  onSelect: (id: string) => void;
}) {
  const kids = childrenOf(folder.id);
  const active = activeFolder === folder.id;
  return (
    <>
      <button
        onClick={() => onSelect(folder.id)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
          active ? "bg-[#354F99]/8 text-[#354F99] font-semibold" : "text-gray-600 hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {active ? <FolderOpen className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{folder.name}</span>
      </button>
      {kids.map((k) => (
        <FolderNode key={k.id} folder={k} depth={depth + 1} childrenOf={childrenOf} activeFolder={activeFolder} onSelect={onSelect} />
      ))}
    </>
  );
}
