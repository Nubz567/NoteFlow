import "./home.css";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  pinned: boolean;
  order: number;
  notebookId: string | null;
  color: string;
};

type Notebook = {
  id: string;
  name: string;
  createdAt: Date;
  color: string;
};

type Page = "notes" | "edit" | "settings";
type StoredNote = Omit<Note, "createdAt"> & {
  createdAt: string;
};
type StoredNotebook = Omit<Notebook, "createdAt"> & {
  createdAt: string;
};
type ThemeMode = "light" | "dark";
type SortMode = "custom" | "date" | "title" | "random";
type AppSettings = {
  theme: ThemeMode;
  brightness: number;
  sortMode: SortMode;
};

const NOTES_STORAGE_KEY = "noteflow.notes";
const NOTEBOOKS_STORAGE_KEY = "noteflow.notebooks";
const SETTINGS_STORAGE_KEY = "noteflow.settings";
const DEFAULT_NOTE_COLOR = "none";
const DEFAULT_NOTEBOOK_COLOR = "none";
const MAX_NOTE_TITLE_LENGTH = 25;
const COLOR_PRESETS = [
  { id: "none", label: "None", value: "transparent" },
  { id: "red", label: "Red", value: "#fecaca" },
  { id: "orange", label: "Orange", value: "#fed7aa" },
  { id: "yellow", label: "Yellow", value: "#fef08a" },
  { id: "green", label: "Green", value: "#bbf7d0" },
  { id: "blue", label: "Blue", value: "#bfdbfe" },
  { id: "purple", label: "Purple", value: "#ddd6fe" },
  { id: "pink", label: "Pink", value: "#fbcfe8" },
  { id: "black", label: "Black", value: "#111827" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "brown", label: "Brown", value: "#b45309" },
] as const;

const notes: Note[] = loadSavedNotes();
const notebooks: Notebook[] = loadSavedNotebooks();
let appSettings: AppSettings = loadSavedSettings();
let selectedNoteId: string | null = null;
let currentPage: Page = "notes";
let searchQuery = "";
let draggedNoteId: string | null = null;
let dragMoved = false;

export function renderHomePage() {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  applyAppSettings();
  app.innerHTML = renderCurrentPage();
  bindHomePageEvents(app);
}

function renderCurrentPage() {
  if (currentPage === "edit") {
    return renderEditPage();
  }

  if (currentPage === "settings") {
    return renderSettingsPage();
  }

  return renderNotesPage();
}

function renderNotesPage() {
  return `
    <main class="notes-page">
      <section class="notes-board" aria-label="Your notes">
        <button class="settings-button" type="button" data-open-settings>
          Settings
        </button>

        <header class="notes-title-card">
          <h1>Your notes</h1>
        </header>

        <div class="notes-controls">
          <label class="notes-search">
            <span>Search notes</span>
            <input
              type="search"
              data-search-notes
              value="${escapeHtml(searchQuery)}"
              placeholder="Search by title or text..."
              aria-label="Search notes"
            />
          </label>

          <label class="notes-sort">
            <span>Sort notes</span>
            <select data-sort-notes aria-label="Sort notes">
              <option value="custom" ${getSelectedAttribute(appSettings.sortMode === "custom")}>Custom order</option>
              <option value="date" ${getSelectedAttribute(appSettings.sortMode === "date")}>Date</option>
              <option value="title" ${getSelectedAttribute(appSettings.sortMode === "title")}>Title</option>
              <option value="random" ${getSelectedAttribute(appSettings.sortMode === "random")}>Random</option>
            </select>
          </label>
        </div>

        <div class="organization-layout">
          <section class="organization-panel notes-panel" aria-label="Notes">
            <header class="organization-panel-header">
              <h2>Notes</h2>
            </header>
            <div class="notes-grid" aria-label="Unfiled notes" data-notebook-drop-id="">
              ${renderNoteCards()}
            </div>
            <button class="create-note-button" type="button" data-create-note>
              Create new note
            </button>
          </section>

          <section class="organization-panel notebooks-section" aria-label="Notebooks">
            <header class="organization-panel-header">
              <h2>Notebooks</h2>
            </header>
            <div class="notebooks-grid">
              ${renderNotebooks()}
            </div>
            <button class="create-notebook-button" type="button" data-create-notebook>
              Create notebook
            </button>
          </section>
        </div>
      </section>
    </main>
  `;
}

function renderSettingsPage() {
  const pinnedNotesCount = notes.filter((note) => note.pinned).length;

  return `
    <main class="settings-page">
      <section class="settings-board" aria-label="Settings">
        <div class="settings-header">
          <button class="back-button" type="button" data-back-to-notes>
            Back to notes
          </button>
          <h1>Settings</h1>
        </div>

        <div class="settings-grid">
          <article class="settings-card">
            <h2>Storage</h2>
            <p>Your notes are saved on this device automatically.</p>
          </article>

          <article class="settings-card setting-control-card">
            <h2>Theme</h2>
            <div class="theme-options" aria-label="Theme mode">
              <button
                class="theme-option ${appSettings.theme === "light" ? "selected" : ""}"
                type="button"
                data-theme-mode="light"
              >
                Light mode
              </button>
              <button
                class="theme-option ${appSettings.theme === "dark" ? "selected" : ""}"
                type="button"
                data-theme-mode="dark"
              >
                Dark mode
              </button>
            </div>
          </article>

          <article class="settings-card setting-control-card">
            <h2>Screen brightness</h2>
            <label class="brightness-control">
              <span>${appSettings.brightness}%</span>
              <input
                type="range"
                min="50"
                max="130"
                step="5"
                value="${appSettings.brightness}"
                data-brightness
                aria-label="Screen brightness"
              />
            </label>
          </article>

          <article class="settings-card">
            <h2>Notes</h2>
            <p>${notes.length} total notes</p>
            <p>${pinnedNotesCount} pinned notes</p>
          </article>

          <article class="settings-card">
            <h2>Version</h2>
            <p>NoteFlow 0.1.0</p>
          </article>
        </div>
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
        <div class="editor-top-row">
          <input
            class="note-title-input ${getNoteTitleSizeClass(selectedNote.title)}"
            data-note-title
            maxlength="${MAX_NOTE_TITLE_LENGTH}"
            value="${escapeHtml(selectedNote.title)}"
            aria-label="Note title"
          />

          <div class="format-toolbar" aria-label="Text formatting">
            <button class="format-button" type="button" data-format="bold">Bold</button>
            <button class="format-button" type="button" data-format="italic">Italics</button>

            <div class="format-menu">
              <button class="format-button" type="button">Numberings</button>
              <div class="format-dropdown">
                <button type="button" data-format="bullet-list">Bullet points</button>
                <button type="button" data-format="numbered-list">Numbers</button>
                <button type="button" data-format="checklist">Checklist</button>
              </div>
            </div>

            <div class="format-menu">
              <button class="format-button" type="button">Headings</button>
              <div class="format-dropdown">
                <button type="button" data-format="heading">Heading</button>
                <button type="button" data-format="subheading">Sub heading</button>
                <button type="button" data-format="title">Title</button>
              </div>
            </div>

            <div class="format-menu">
              <button class="format-button" type="button">Tables</button>
              <div class="format-dropdown table-dropdown">
                <span>Insert</span>
                <button type="button" data-format="insert-table">2 x 2 table</button>
              </div>
            </div>
          </div>
        </div>

        <div class="editor-actions">
          <button class="back-button" type="button" data-back-to-notes>
            Back to notes
          </button>
          <button class="rename-note-button" type="button" data-rename-note>
            Rename
          </button>
        </div>

        <div
          class="note-content-input"
          data-note-content
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label="Note content"
          data-placeholder="Start writing your note..."
        >${selectedNote.content}</div>
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

  const matchingNotes = getMatchingNotes().filter((note) => note.notebookId === null);

  if (matchingNotes.length === 0) {
    return `
      <div class="empty-notes-message">
        <h2>No matching notes</h2>
        <p>Try a different search.</p>
      </div>
    `;
  }

  return renderNoteCardsForList(matchingNotes);
}

function renderNotebooks() {
  if (notebooks.length === 0) {
    return `<p class="empty-notebooks-message">Create a notebook, then drag notes into it.</p>`;
  }

  return notebooks
    .map((notebook) => {
      const notebookNotes = getMatchingNotes().filter((note) => note.notebookId === notebook.id);

      return `
        <article class="notebook-card" data-notebook-drop-id="${notebook.id}" style="background-color: ${getPresetColorValue(notebook.color)}; color: ${getContrastColor(notebook.color)}">
          <div class="notebook-card-header">
            <h3>${escapeHtml(notebook.name)}</h3>
            <div class="notebook-card-actions">
              <span>${notebookNotes.length} notes</span>
              <div class="color-picker-label">
                <span>Color</span>
                <div class="color-options" aria-label="Choose color for notebook ${escapeHtml(notebook.name)}">
                  ${renderColorOptions("notebook", notebook.id, notebook.color)}
                </div>
              </div>
              <button
                class="delete-notebook-button"
                type="button"
                data-delete-notebook-id="${notebook.id}"
                aria-label="Delete notebook ${escapeHtml(notebook.name)}"
              >
                Delete
              </button>
            </div>
          </div>
          <div class="notebook-notes">
            ${
              notebookNotes.length > 0
                ? renderNoteCardsForList(notebookNotes)
                : `<p class="empty-notebook-message">Drop notes here</p>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNoteCardsForList(notesToRender: Note[]) {
  return notesToRender
    .map(
      (note, index) => `
        <article
          class="note-card note-card-${(index % 6) + 1} ${note.pinned ? "pinned" : ""}"
          data-note-id="${note.id}"
          data-drag-note-id="${note.id}"
          style="background-color: ${getPresetColorValue(note.color)}; color: ${getContrastColor(note.color)}"
          role="button"
          tabindex="0"
        >
          <div
            class="note-open-button"
          >
            <span>${escapeHtml(note.title)}</span>
          </div>
          <button
            class="pin-note-button"
            type="button"
            draggable="false"
            data-pin-note-id="${note.id}"
            aria-label="${note.pinned ? "Unpin" : "Pin"} ${escapeHtml(note.title)}"
          >
            ${note.pinned ? "Pinned" : "Pin"}
          </button>
          <div class="color-picker-label">
            <span>Color</span>
            <div class="color-options" aria-label="Choose color for ${escapeHtml(note.title)}">
              ${renderColorOptions("note", note.id, note.color)}
            </div>
          </div>
          <button
            class="delete-note-button note-card-delete-button"
            type="button"
            draggable="false"
            data-delete-note-id="${note.id}"
            aria-label="Delete ${escapeHtml(note.title)}"
          >
            Delete
          </button>
        </article>
      `,
    )
    .join("");
}

function bindHomePageEvents(app: HTMLDivElement) {
  app.querySelector("[data-create-note]")?.addEventListener("click", createNote);
  app.querySelector("[data-create-notebook]")?.addEventListener("click", createNotebook);

  app.querySelector("[data-open-settings]")?.addEventListener("click", () => {
    currentPage = "settings";
    renderHomePage();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-theme-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      appSettings.theme = button.dataset.themeMode === "dark" ? "dark" : "light";
      saveSettings();
      renderHomePage();
    });
  });

  app.querySelector<HTMLInputElement>("[data-brightness]")?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;

    appSettings.brightness = Number(input.value);
    saveSettings();
    applyAppSettings();
    renderSettingsValues(app);
  });

  app.querySelector<HTMLInputElement>("[data-search-notes]")?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;

    searchQuery = input.value;
    renderNotesCollectionsOnly(app);
  });

  app.querySelector<HTMLSelectElement>("[data-sort-notes]")?.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;

    appSettings.sortMode = parseSortMode(select.value);
    saveSettings();
    renderNotesCollectionsOnly(app);
  });

  bindNoteOpenEvents(app);

  bindPinNoteEvents(app);
  bindDeleteNoteEvents(app);
  bindDeleteNotebookEvents(app);
  bindColorEvents(app);
  bindDragNoteEvents(app);

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
    const title = limitNoteTitle(input.value);

    if (input.value !== title) {
      input.value = title;
    }

    selectedNote.title = title || "Untitled note";
    updateNoteTitleSize(input);
    saveNotes();
  });

  app.querySelector("[data-rename-note]")?.addEventListener("click", () => {
    renameSelectedNote(selectedNote);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", () => {
      applyTextFormatting(button.dataset.format, selectedNote);
    });
  });

  app.querySelector<HTMLDivElement>("[data-note-content]")?.addEventListener("input", (event) => {
    const editor = event.target as HTMLDivElement;

    selectedNote.content = editor.innerHTML;
    saveNotes();
  });
}

function createNote() {
  const noteNumber = notes.length + 1;
  const note: Note = {
    id: crypto.randomUUID(),
    title: `Note ${noteNumber}`,
    content: "",
    createdAt: new Date(),
    pinned: false,
    order: getNextNoteOrder(),
    notebookId: null,
    color: DEFAULT_NOTE_COLOR,
  };

  notes.push(note);
  saveNotes();
  selectedNoteId = note.id;
  currentPage = "edit";
  renderHomePage();
}

function createNotebook() {
  const name = window.prompt("Notebook name", `Notebook ${notebooks.length + 1}`)?.trim();

  if (!name) {
    return;
  }

  notebooks.push({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    color: DEFAULT_NOTEBOOK_COLOR,
  });
  saveNotebooks();
  renderHomePage();
}

function getSelectedNote() {
  return notes.find((note) => note.id === selectedNoteId) ?? null;
}

function getMatchingNotes() {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return getSortedNotes(notes);
  }

  const matchingNotes = notes.filter((note) => {
    const searchableContent = stripHtml(note.content).toLowerCase();

    return note.title.toLowerCase().includes(normalizedQuery) || searchableContent.includes(normalizedQuery);
  });

  return getSortedNotes(matchingNotes);
}

function renderNotesCollectionsOnly(app: HTMLDivElement) {
  const notesGrid = app.querySelector<HTMLDivElement>(".notes-grid");
  const notebooksGrid = app.querySelector<HTMLDivElement>(".notebooks-grid");

  if (notesGrid) {
    notesGrid.innerHTML = renderNoteCards();
  }

  if (notebooksGrid) {
    notebooksGrid.innerHTML = renderNotebooks();
  }

  bindNoteOpenEvents(app);
  bindPinNoteEvents(app);
  bindDeleteNoteEvents(app);
  bindDeleteNotebookEvents(app);
  bindColorEvents(app);
  bindDragNoteEvents(app);
}

function bindNoteOpenEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLElement>("[data-note-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (dragMoved) {
        return;
      }

      if ((event.target as HTMLElement).closest("[data-pin-note-id], [data-delete-note-id], .color-picker-label")) {
        return;
      }

      openNote(card.dataset.noteId ?? null);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openNote(card.dataset.noteId ?? null);
    });
  });
}

function bindDragNoteEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLElement>("[data-drag-note-id]").forEach((card) => {
    card.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest("[data-pin-note-id], [data-delete-note-id], .color-picker-label")) {
        return;
      }

      draggedNoteId = card.dataset.dragNoteId ?? null;

      if (!draggedNoteId) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const distanceX = Math.abs(moveEvent.clientX - startX);
        const distanceY = Math.abs(moveEvent.clientY - startY);

        if (!dragMoved && distanceX + distanceY > 6) {
          dragMoved = true;
          card.classList.add("dragging");
        }

        if (dragMoved) {
          moveEvent.preventDefault();
          markPointerDropTarget(app, moveEvent.clientX, moveEvent.clientY);
        }
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        card.classList.remove("dragging");

        if (dragMoved) {
          dropPointerDraggedNote(app, upEvent.clientX, upEvent.clientY);
        }

        clearDropTargets(app);
        draggedNoteId = null;
        setTimeout(() => {
          dragMoved = false;
        }, 0);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp, { once: true });
    });
  });
}

function markPointerDropTarget(app: HTMLDivElement, clientX: number, clientY: number) {
  clearDropTargets(app);

  const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const targetCard = target?.closest<HTMLElement>("[data-drag-note-id]");
  const targetNotebook = target?.closest<HTMLElement>("[data-notebook-drop-id]");

  if (targetCard && targetCard.dataset.dragNoteId !== draggedNoteId) {
    targetCard.classList.add("drop-target");
    return;
  }

  targetNotebook?.classList.add("drop-target");
}

function dropPointerDraggedNote(app: HTMLDivElement, clientX: number, clientY: number) {
  const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const targetCard = target?.closest<HTMLElement>("[data-drag-note-id]");
  const targetNotebook = target?.closest<HTMLElement>("[data-notebook-drop-id]");

  if (targetCard && targetCard.dataset.dragNoteId !== draggedNoteId) {
    reorderNote(draggedNoteId, targetCard.dataset.dragNoteId ?? null);
    renderNotesCollectionsOnly(app);
    return;
  }

  if (targetNotebook) {
    moveNoteToNotebook(draggedNoteId, targetNotebook.dataset.notebookDropId || null);
    renderNotesCollectionsOnly(app);
  }
}

function reorderNote(sourceNoteId: string | null, targetNoteId: string | null) {
  if (!sourceNoteId || !targetNoteId || sourceNoteId === targetNoteId) {
    return;
  }

  const sortedNotes = getSortedNotes(notes);
  const sourceIndex = sortedNotes.findIndex((note) => note.id === sourceNoteId);
  const targetIndex = sortedNotes.findIndex((note) => note.id === targetNoteId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

  const [movedNote] = sortedNotes.splice(sourceIndex, 1);
  movedNote.notebookId = sortedNotes[targetIndex]?.notebookId ?? null;
  sortedNotes.splice(targetIndex, 0, movedNote);

  sortedNotes.forEach((note, index) => {
    note.order = index;
  });

  appSettings.sortMode = "custom";
  saveSettings();
  saveNotes();
}

function clearDropTargets(app: HTMLDivElement) {
  app.querySelectorAll(".drop-target").forEach((target) => {
    target.classList.remove("drop-target");
  });
}

function moveNoteToNotebook(noteId: string | null, notebookId: string | null) {
  const note = notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  note.notebookId = notebookId;
  saveNotes();
}

function openNote(noteId: string | null) {
  selectedNoteId = noteId;
  currentPage = "edit";
  renderHomePage();
}

function bindPinNoteEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-pin-note-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = notes.find((item) => item.id === button.dataset.pinNoteId);

      if (!note) {
        return;
      }

      note.pinned = !note.pinned;
      saveNotes();
      renderNotesCollectionsOnly(app);
    });
  });
}

function bindDeleteNoteEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-delete-note-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = notes.find((item) => item.id === button.dataset.deleteNoteId);

      if (!note) {
        return;
      }

      deleteSelectedNote(note);
    });
  });
}

function bindDeleteNotebookEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-delete-notebook-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const notebook = notebooks.find((item) => item.id === button.dataset.deleteNotebookId);

      if (!notebook) {
        return;
      }

      deleteNotebook(notebook);
    });
  });
}

function bindColorEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-note-color-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = notes.find((item) => item.id === button.dataset.noteColorId);

      if (!note) {
        return;
      }

      note.color = getPresetColorId(button.dataset.colorValue);
      saveNotes();
      renderNotesCollectionsOnly(app);
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-notebook-color-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const notebook = notebooks.find((item) => item.id === button.dataset.notebookColorId);

      if (!notebook) {
        return;
      }

      notebook.color = getPresetColorId(button.dataset.colorValue);
      saveNotebooks();
      renderNotesCollectionsOnly(app);
    });
  });
}

function deleteNotebook(notebook: Notebook) {
  const shouldDelete = window.confirm(`Delete notebook "${notebook.name}"? Notes inside it will move back to Notes.`);

  if (!shouldDelete) {
    return;
  }

  const notebookIndex = notebooks.findIndex((item) => item.id === notebook.id);

  if (notebookIndex === -1) {
    return;
  }

  notebooks.splice(notebookIndex, 1);
  notes.forEach((note) => {
    if (note.notebookId === notebook.id) {
      note.notebookId = null;
    }
  });

  saveNotebooks();
  saveNotes();
  renderHomePage();
}

function getSortedNotes(notesToSort: Note[]) {
  return [...notesToSort].sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
    }

    if (appSettings.sortMode === "date") {
      return second.createdAt.getTime() - first.createdAt.getTime();
    }

    if (appSettings.sortMode === "title") {
      return first.title.localeCompare(second.title);
    }

    if (appSettings.sortMode === "random") {
      return getStableRandomValue(first.id) - getStableRandomValue(second.id);
    }

    return first.order - second.order;
  });
}

function renameSelectedNote(note: Note) {
  const newTitle = normalizeNoteTitle(window.prompt("Rename note", note.title) ?? "");

  if (!newTitle) {
    return;
  }

  note.title = newTitle;
  saveNotes();
  renderHomePage();
}

function normalizeNoteTitle(title: string) {
  return limitNoteTitle(title.trim());
}

function limitNoteTitle(title: string) {
  return title.slice(0, MAX_NOTE_TITLE_LENGTH);
}

function getNoteTitleSizeClass(title: string) {
  if (title.length >= 21) {
    return "note-title-input-size-4";
  }

  if (title.length >= 16) {
    return "note-title-input-size-3";
  }

  if (title.length >= 11) {
    return "note-title-input-size-2";
  }

  if (title.length >= 6) {
    return "note-title-input-size-1";
  }

  return "";
}

function updateNoteTitleSize(input: HTMLInputElement) {
  input.classList.remove(
    "note-title-input-size-1",
    "note-title-input-size-2",
    "note-title-input-size-3",
    "note-title-input-size-4",
  );

  const sizeClass = getNoteTitleSizeClass(input.value);

  if (sizeClass) {
    input.classList.add(sizeClass);
  }
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
  saveNotes();
  selectedNoteId = null;
  currentPage = "notes";
  renderHomePage();
}

function applyTextFormatting(format: string | undefined, note: Note) {
  const editor = document.querySelector<HTMLDivElement>("[data-note-content]");

  if (!editor) {
    return;
  }

  editor.focus();

  if (format === "bold") {
    document.execCommand("bold");
  }

  if (format === "italic") {
    document.execCommand("italic");
  }

  if (format === "heading") {
    document.execCommand("formatBlock", false, "h2");
  }

  if (format === "subheading") {
    document.execCommand("formatBlock", false, "h3");
  }

  if (format === "title") {
    document.execCommand("formatBlock", false, "h1");
  }

  if (format === "bullet-list") {
    document.execCommand("insertUnorderedList");
  }

  if (format === "numbered-list") {
    document.execCommand("insertOrderedList");
  }

  if (format === "checklist") {
    document.execCommand(
      "insertHTML",
      false,
      `<ul class="checklist"><li><label><input type="checkbox" /> Checklist item</label></li></ul>`,
    );
  }

  if (format === "insert-table") {
    document.execCommand(
      "insertHTML",
      false,
      `<table><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table>`,
    );
  }

  note.content = editor.innerHTML;
  saveNotes();
}

function loadSavedNotes() {
  const savedNotes = localStorage.getItem(NOTES_STORAGE_KEY);

  if (!savedNotes) {
    return [];
  }

  try {
    const parsedNotes = JSON.parse(savedNotes) as StoredNote[];

    return parsedNotes.map((note, index) => ({
      ...note,
      title: normalizeNoteTitle(note.title) || "Untitled note",
      createdAt: new Date(note.createdAt),
      pinned: Boolean(note.pinned),
      order: typeof note.order === "number" ? note.order : index,
      notebookId: typeof note.notebookId === "string" ? note.notebookId : null,
      color: getPresetColorId(note.color),
    }));
  } catch {
    return [];
  }
}

function loadSavedNotebooks() {
  const savedNotebooks = localStorage.getItem(NOTEBOOKS_STORAGE_KEY);

  if (!savedNotebooks) {
    return [];
  }

  try {
    const parsedNotebooks = JSON.parse(savedNotebooks) as StoredNotebook[];

    return parsedNotebooks.map((notebook) => ({
      ...notebook,
      createdAt: new Date(notebook.createdAt),
      color: getPresetColorId(notebook.color),
    }));
  } catch {
    return [];
  }
}

function saveNotebooks() {
  const notebooksToStore: StoredNotebook[] = notebooks.map((notebook) => ({
    ...notebook,
    createdAt: notebook.createdAt.toISOString(),
  }));

  localStorage.setItem(NOTEBOOKS_STORAGE_KEY, JSON.stringify(notebooksToStore));
}

function getNextNoteOrder() {
  if (notes.length === 0) {
    return 0;
  }

  return Math.max(...notes.map((note) => note.order)) + 1;
}

function saveNotes() {
  const notesToStore: StoredNote[] = notes.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
  }));

  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesToStore));
}

function loadSavedSettings(): AppSettings {
  const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

  if (!savedSettings) {
    return {
      theme: "light",
      brightness: 100,
      sortMode: "custom",
    };
  }

  try {
    const parsedSettings = JSON.parse(savedSettings) as Partial<AppSettings>;

    return {
      theme: parsedSettings.theme === "dark" ? "dark" : "light",
      brightness: clampBrightness(parsedSettings.brightness ?? 100),
      sortMode: parseSortMode(parsedSettings.sortMode),
    };
  } catch {
    return {
      theme: "light",
      brightness: 100,
      sortMode: "custom",
    };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
}

function applyAppSettings() {
  document.documentElement.dataset.theme = appSettings.theme;
  document.documentElement.style.setProperty("--app-brightness", `${appSettings.brightness}%`);
}

function renderSettingsValues(app: HTMLDivElement) {
  const brightnessLabel = app.querySelector<HTMLElement>(".brightness-control span");

  if (brightnessLabel) {
    brightnessLabel.textContent = `${appSettings.brightness}%`;
  }
}

function clampBrightness(value: number) {
  return Math.min(130, Math.max(50, value));
}

function parseSortMode(value: unknown): SortMode {
  if (value === "date" || value === "title" || value === "random") {
    return value;
  }

  return "custom";
}

function getSelectedAttribute(isSelected: boolean) {
  return isSelected ? "selected" : "";
}

function getStableRandomValue(value: string) {
  return [...value].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) % 100000;
  }, 7);
}

function renderColorOptions(targetType: "note" | "notebook", targetId: string, selectedColor: string) {
  const selectedPreset = getPresetColorId(selectedColor);

  return COLOR_PRESETS.map((preset) => {
    const dataAttribute = targetType === "note" ? `data-note-color-id="${targetId}"` : `data-notebook-color-id="${targetId}"`;
    const selectedClass = preset.id === selectedPreset ? "selected" : "";

    return `
      <button
        class="color-option ${selectedClass}"
        type="button"
        ${dataAttribute}
        data-color-value="${preset.id}"
        title="${preset.label}"
        aria-label="${preset.label}"
        style="background-color: ${getPresetColorValue(preset.id)}"
      ></button>
    `;
  }).join("");
}

function getPresetColorId(value: unknown) {
  if (typeof value !== "string") {
    return "none";
  }

  const matchingPreset = COLOR_PRESETS.find((preset) => preset.id === value || preset.value.toLowerCase() === value.toLowerCase());

  return matchingPreset?.id ?? "none";
}

function getPresetColorValue(colorId: string) {
  const preset = COLOR_PRESETS.find((item) => item.id === getPresetColorId(colorId));

  if (!preset || preset.id === "none") {
    return "var(--surface-background)";
  }

  return preset.value;
}

function getContrastColor(colorId: string) {
  if (getPresetColorId(colorId) === "none") {
    return "var(--surface-text)";
  }

  const color = getPresetColorValue(colorId);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 150 ? "#020617" : "#ffffff";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");

  return document.body.textContent ?? "";
}
