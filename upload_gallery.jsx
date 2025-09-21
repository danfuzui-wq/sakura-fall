import React, { useEffect, useState, useRef } from "react";

// UploadGallery.jsx
// Single-file React component for uploading and browsing files (video, docx, pdf, txt...)
// - Uses IndexedDB to persist file blobs + metadata so files remain after refresh
// - Shows list, search, sort, preview (video inline), download, delete
// Requirements: Tailwind CSS in project (optional, component uses Tailwind classes)

const DB_NAME = "fileUploadsDB";
const STORE_NAME = "files";
const DB_VERSION = 1;

// --- Minimal IndexedDB helper ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function addFileToDB(file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry = {
      name: file.name,
      type: file.type,
      size: file.size,
      date: new Date().toISOString(),
      blob: file,
    };
    const req = store.add(entry);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAllFilesFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getFileBlobById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(Number(id));
    req.onsuccess = (e) => {
      const res = e.target.result;
      if (res) resolve(res.blob);
      else resolve(null);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteFileById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(Number(id));
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

// --- React component ---
export default function UploadGallery() {
  const [files, setFiles] = useState([]); // metadata array from DB
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("dateDesc");
  const [preview, setPreview] = useState(null); // { id, url, type }
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    loadFiles();
    // drag-drop listeners
    const div = dropRef.current;
    if (!div) return;
    const onDragOver = (e) => { e.preventDefault(); div.classList.add("ring-2"); };
    const onDragLeave = () => div.classList.remove("ring-2");
    const onDrop = async (e) => {
      e.preventDefault();
      div.classList.remove("ring-2");
      const dropped = Array.from(e.dataTransfer.files);
      await handleFiles(dropped);
    };
    div.addEventListener("dragover", onDragOver);
    div.addEventListener("dragleave", onDragLeave);
    div.addEventListener("drop", onDrop);
    return () => {
      div.removeEventListener("dragover", onDragOver);
      div.removeEventListener("dragleave", onDragLeave);
      div.removeEventListener("drop", onDrop);
    };
  }, []);

  async function loadFiles() {
    const all = await getAllFilesFromDB();
    setFiles(all || []);
  }

  async function handleFiles(selectedFiles) {
    for (const f of selectedFiles) {
      await addFileToDB(f);
    }
    await loadFiles();
  }

  function onFileChange(e) {
    const list = Array.from(e.target.files || []);
    handleFiles(list);
    e.target.value = null;
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function filteredAndSorted() {
    let list = files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
    if (sortBy === "dateDesc") list = list.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (sortBy === "dateAsc") list = list.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (sortBy === "nameAsc") list = list.sort((a,b) => a.name.localeCompare(b.name));
    if (sortBy === "nameDesc") list = list.sort((a,b) => b.name.localeCompare(a.name));
    return list;
  }

  async function openPreview(fileMeta) {
    const blob = await getFileBlobById(fileMeta.id);
    if (!blob) return alert("Không tìm thấy file trong DB.");
    const url = URL.createObjectURL(blob);
    setPreview({ id: fileMeta.id, url, type: fileMeta.type, name: fileMeta.name });
  }

  function closePreview() {
    if (preview && preview.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function downloadFile(fileMeta) {
    const blob = await getFileBlobById(fileMeta.id);
    if (!blob) return alert("Không tìm thấy file để tải.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileMeta.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function removeFile(fileMeta) {
    if (!confirm(`Xóa '${fileMeta.name}'?`)) return;
    await deleteFileById(fileMeta.id);
    await loadFiles();
    if (preview && preview.id === fileMeta.id) closePreview();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">📁 Quản lý upload — Video / Word / PDF / TXT</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <div
            ref={dropRef}
            className="border-2 border-dashed rounded-lg p-6 text-center hover:ring-2 transition-all"
          >
            <p className="mb-2">Kéo thả tệp vào đây hoặc bấm nút để chọn (video, .docx/.doc, .pdf, .txt...)</p>
            <div className="flex gap-2 justify-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFileChange}
                className="hidden"
                id="file-input"
                accept="video/*,.doc,.docx,.pdf,.txt"
              />
              <label htmlFor="file-input" className="btn px-4 py-2 rounded bg-blue-600 text-white cursor-pointer">Chọn tệp</label>
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="px-4 py-2 rounded border"
              >Tải lên</button>
            </div>
            <p className="text-sm text-gray-500 mt-3">Lưu ý: các tệp được lưu lên trình duyệt (IndexedDB) — không đồng bộ server.</p>
          </div>
        </div>

        <div className="space-y-2">
          <input
            placeholder="Tìm theo tên..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full p-2 border rounded">
            <option value="dateDesc">Mới nhất</option>
            <option value="dateAsc">Cũ nhất</option>
            <option value="nameAsc">Tên A → Z</option>
            <option value="nameDesc">Tên Z → A</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4">
        <h2 className="font-medium mb-3">Danh sách tệp ({files.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="p-2">Preview</th>
                <th className="p-2">Tên</th>
                <th className="p-2">Loại</th>
                <th className="p-2">Kích thước</th>
                <th className="p-2">Ngày</th>
                <th className="p-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted().map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="p-2 align-top w-28">
                    {f.type.startsWith("video/") ? (
                      <video
                        width={120}
                        height={68}
                        controls={false}
                        onClick={() => openPreview(f)}
                        className="cursor-pointer rounded"
                      >
                        {/* small inline poster isn't stored; we'll open full preview on click */}
                      </video>
                    ) : (
                      <div className="text-xs text-gray-500">{f.type || 'file'}</div>
                    )}
                  </td>
                  <td className="p-2 align-top">{f.name}</td>
                  <td className="p-2 align-top">{f.type || "--"}</td>
                  <td className="p-2 align-top">{humanSize(f.size)}</td>
                  <td className="p-2 align-top">{new Date(f.date).toLocaleString()}</td>
                  <td className="p-2 align-top">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded text-sm" onClick={() => openPreview(f)}>Xem</button>
                      <button className="px-2 py-1 border rounded text-sm" onClick={() => downloadFile(f)}>Tải</button>
                      <button className="px-2 py-1 border rounded text-sm text-red-600" onClick={() => removeFile(f)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAndSorted().length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Chưa có tệp phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4">
          <div className="bg-white rounded shadow-lg max-w-4xl w-full overflow-auto">
            <div className="flex justify-between items-center p-3 border-b">
              <div className="font-medium">{preview.name}</div>
              <div className="flex gap-2">
                <a href={preview.url} download={preview.name} className="px-3 py-1 border rounded">Tải</a>
                <button onClick={closePreview} className="px-3 py-1 border rounded">Đóng</button>
              </div>
            </div>
            <div className="p-4">
              {preview.type.startsWith("video/") ? (
                <video src={preview.url} controls className="w-full rounded" />
              ) : preview.type === "application/pdf" ? (
                <iframe src={preview.url} title="pdf-preview" className="w-full h-[70vh] border" />
              ) : (
                <div>
                  <p className="mb-2">Trình xem mặc định không hỗ trợ xem định dạng này trong trình duyệt.</p>
                  <p className="text-sm text-gray-600">Bạn có thể tải về để mở bằng phần mềm tương ứng.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>Ghi chú:</p>
        <ul className="list-disc ml-5">
          <li>Hiện tại component lưu file trên trình duyệt (IndexedDB). Nếu bạn cần chia sẻ qua server, cần thêm backend API để upload và lưu file.</li>
          <li>Để xem nội dung .docx trong trình duyệt, có thể tích hợp <code>mammoth.js</code> (hoặc server-side conversion) — mình để chỗ này nếu bạn muốn mở rộng.</li>
          <li>Nếu muốn giới hạn dung lượng, thêm kiểm tra trước khi addFileToDB.</li>
        </ul>
      </div>
    </div>
  );
}
