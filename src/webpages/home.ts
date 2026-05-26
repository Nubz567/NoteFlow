import "./home.css";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
};

type Page = "notes" | "edit";

const notes: Note[] = [];
let selectedNoteId: string | null = null;
let currentPage: Page = "notes";

export function renderHomePage() {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  app.innerHTML = currentPage === "edit" ? renderEditPage() : renderNotesPage();
  bindHomePageEvents(app);
}

function renderNotesPage() {
  return `
    <main class="notes-page">
      <section class="notes-board" aria-label="Your notes">
        <header class="notes-title-card">
          <h1>Your notes</h1>
        </header>

        <div class="notes-grid" aria-label="Notes">
          ${renderNoteCards()}
        </div>

        <button class="create-note-button" type="button" data-create-note>
          Create new note
        </button>
      </section>
    </main>
  `;
}

function renderEditPage() {
  const selectedNote = getSelectedNote();

  if (!selectedNote) {
    currentPage = "notes";
    return renderNotesPage();
  }

  return `
    <main class="edit-page">
      <section class="note-editor" aria-label="Edit note">
        <div class="note-editor-header">
          <button class="back-button" type="button" data-back-to-notes>
            Back to notes
          </button>
          <div class="editor-actions">
            <button class="rename-note-button" type="button" data-rename-note>
              Rename
            </button>
            <button class="delete-note-button" type="button" data-delete-note>
              Delete
            </button>
          </div>
        </div>

        <input
          class="note-title-input"
          data-note-title
          value="${escapeHtml(selectedNote.title)}"
          aria-label="Note title"
        />
        <textarea
          class="note-content-input"
          data-note-content
          placeholder="Start writing your note..."
          aria-label="Note content"
        >${escapeHtml(selectedNote.content)}</textarea>
      </section>
    </main>
  `;
}

function renderNoteCards() {
  if (notes.length === 0) {
    return `
      <div class="empty-notes-message">
        <h2>No notes yet</h2>
        <p>Create your first note to start writing.</p>
      </div>
    `;
  }

  return notes
    .map(
      (note, index) => `
        <button
          class="note-card note-card-${(index % 6) + 1}"
          type="button"
          data-note-id="${note.id}"
        >
          <span>${escapeHtml(note.title)}</span>
        </button>
      `,
    )
    .join("");
}

function bindHomePageEvents(app: HTMLDivElement) {
  app.querySelector("[data-create-note]")?.addEventListener("click", createNote);

  app.querySelectorAll<HTMLButtonElement>("[data-note-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedNoteId = button.dataset.noteId ?? null;
      currentPage = "edit";
      renderHomePage();
    });
  });

  app.querySelector("[data-back-to-notes]")?.addEventListener("click", () => {
    currentPage = "notes";
    renderHomePage();
  });

  const selectedNote = getSelectedNote();

  if (!selectedNote) {
    return;
  }

  app.querySelector<HTMLInputElement>("[data-note-title]")?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;

    selectedNote.title = input.value || "Untitled note";
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

function createNote() {
  const noteNumber = notes.length + 1;
  const note: Note = {
    id: crypto.randomUUID(),
    title: `Note ${noteNumber}`,
    content: "",
    createdAt: new Date(),
  };

  notes.push(note);
  selectedNoteId = note.id;
  currentPage = "edit";
  renderHomePage();
}

function getSelectedNote() {
  return notes.find((note) => note.id === selectedNoteId) ?? null;
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
  selectedNoteId = null;
  currentPage = "notes";
  renderHomePage();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
