import "./home.css";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
};

const notes: Note[] = [];
let selectedNoteId: string | null = null;

export function renderHomePage() {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  const selectedNote = getSelectedNote();

  app.innerHTML = `
    <main class="app-shell">
      <aside class="sidebar">
        <div>
          <p class="eyebrow">NoteFlow</p>
          <h1>Your notes</h1>
          <p class="sidebar-copy">Capture ideas, drafts, and reminders in one calm place.</p>
        </div>

        <div class="notes-panel">
          <button class="create-note-button" type="button" data-create-note>
            Create note
          </button>

          <div class="note-list" aria-label="Notes">
            ${renderNoteList()}
          </div>
        </div>
      </aside>

      ${selectedNote ? renderEditor(selectedNote) : renderEmptyState()}
    </main>
  `;

  bindHomePageEvents(app);
}

function createNote() {
  const noteNumber = notes.length + 1;
  const note: Note = {
    id: crypto.randomUUID(),
    title: `Untitled note ${noteNumber}`,
    content: "",
    createdAt: new Date(),
  };

  notes.unshift(note);
  selectedNoteId = note.id;
  renderHomePage();
}

function getSelectedNote() {
  return notes.find((note) => note.id === selectedNoteId) ?? null;
}

function renderNoteList() {
  if (notes.length === 0) {
    return `<p class="empty-note-list">No notes yet.</p>`;
  }

  return notes
    .map((note) => {
      const isSelected = note.id === selectedNoteId;

      return `
        <button
          class="note-list-item ${isSelected ? "selected" : ""}"
          type="button"
          data-note-id="${note.id}"
        >
          <span>${escapeHtml(note.title)}</span>
          <small>${formatDate(note.createdAt)}</small>
        </button>
      `;
    })
    .join("");
}

function renderEmptyState() {
  return `
    <section class="empty-state" aria-label="Note editor">
      <p class="eyebrow">Editor</p>
      <h2>Select or create a note</h2>
      <p>Your note editor will appear here once you create your first note.</p>
    </section>
  `;
}

function renderEditor(note: Note) {
  return `
    <section class="note-editor" aria-label="Note editor">
      <div class="note-editor-header">
        <input
          class="note-title-input"
          data-note-title
          value="${escapeHtml(note.title)}"
          aria-label="Note title"
        />
        <button class="rename-note-button" type="button" data-rename-note>
          Rename
        </button>
        <button class="delete-note-button" type="button" data-delete-note>
          Delete
        </button>
      </div>
      <textarea
        class="note-content-input"
        data-note-content
        placeholder="Start writing your note..."
        aria-label="Note content"
      >${escapeHtml(note.content)}</textarea>
    </section>
  `;
}

function bindHomePageEvents(app: HTMLDivElement) {
  app.querySelector("[data-create-note]")?.addEventListener("click", createNote);
  bindNoteSelectionEvents(app);

  const selectedNote = getSelectedNote();

  if (!selectedNote) {
    return;
  }

  app.querySelector<HTMLInputElement>("[data-note-title]")?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;

    selectedNote.title = input.value || "Untitled note";
    renderNoteListOnly(app);
  });

  app.querySelector("[data-rename-note]")?.addEventListener("click", () => {
    renameSelectedNote(selectedNote);
  });

  app.querySelector("[data-delete-note]")?.addEventListener("click", () => {
    deleteSelectedNote(selectedNote);
  });

  app.querySelector<HTMLTextAreaElement>("[data-note-content]")?.addEventListener("input", (event) => {
    const textarea = event.target as HTMLTextAreaElement;

    selectedNote.content = textarea.value;
  });
}

function bindNoteSelectionEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-note-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedNoteId = button.dataset.noteId ?? null;
      renderHomePage();
    });
  });
}

function renameSelectedNote(note: Note) {
  const newTitle = window.prompt("Rename note", note.title)?.trim();

  if (!newTitle) {
    return;
  }

  note.title = newTitle;
  renderHomePage();
}

function deleteSelectedNote(note: Note) {
  const shouldDelete = window.confirm(`Delete "${note.title}"?`);

  if (!shouldDelete) {
    return;
  }

  const noteIndex = notes.findIndex((item) => item.id === note.id);

  if (noteIndex === -1) {
    return;
  }

  notes.splice(noteIndex, 1);
  selectedNoteId = notes[noteIndex]?.id ?? notes[noteIndex - 1]?.id ?? null;
  renderHomePage();
}

function renderNoteListOnly(app: HTMLDivElement) {
  const noteList = app.querySelector<HTMLDivElement>(".note-list");

  if (noteList) {
    noteList.innerHTML = renderNoteList();
    bindNoteSelectionEvents(app);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
