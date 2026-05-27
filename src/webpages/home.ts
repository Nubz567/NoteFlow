import "./home.css";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  pinned: boolean;
};

type Page = "notes" | "edit" | "settings";
type StoredNote = Omit<Note, "createdAt"> & {
  createdAt: string;
};
type ThemeMode = "light" | "dark";
type AppSettings = {
  theme: ThemeMode;
  brightness: number;
};

const NOTES_STORAGE_KEY = "noteflow.notes";
const SETTINGS_STORAGE_KEY = "noteflow.settings";

const notes: Note[] = loadSavedNotes();
let appSettings: AppSettings = loadSavedSettings();
let selectedNoteId: string | null = null;
let currentPage: Page = "notes";
let searchQuery = "";

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
            class="note-title-input"
            data-note-title
            value="${escapeHtml(selectedNote.title)}"
            aria-label="Note title"
          />

          <div class="format-toolbar" aria-label="Text formatting">
            <button type="button" data-format="bold">Bold</button>
            <button type="button" data-format="italic">Italics</button>
            <button type="button" data-format="heading">Heading</button>
            <button type="button" data-format="bullet-list">Bullets</button>
            <button type="button" data-format="numbered-list">Numbering</button>
          </div>
        </div>

        <div class="editor-actions">
          <button class="back-button" type="button" data-back-to-notes>
            Back to notes
          </button>
          <button class="rename-note-button" type="button" data-rename-note>
            Rename
          </button>
          <button class="delete-note-button" type="button" data-delete-note>
            Delete
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

  const matchingNotes = getMatchingNotes();

  if (matchingNotes.length === 0) {
    return `
      <div class="empty-notes-message">
        <h2>No matching notes</h2>
        <p>Try a different search.</p>
      </div>
    `;
  }

  return matchingNotes
    .map(
      (note, index) => `
        <article
          class="note-card note-card-${(index % 6) + 1} ${note.pinned ? "pinned" : ""}"
          data-note-id="${note.id}"
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
            data-pin-note-id="${note.id}"
            aria-label="${note.pinned ? "Unpin" : "Pin"} ${escapeHtml(note.title)}"
          >
            ${note.pinned ? "Pinned" : "Pin"}
          </button>
        </article>
      `,
    )
    .join("");
}

function bindHomePageEvents(app: HTMLDivElement) {
  app.querySelector("[data-create-note]")?.addEventListener("click", createNote);

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
    renderNoteCardsOnly(app);
  });

  bindNoteOpenEvents(app);

  bindPinNoteEvents(app);

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
    saveNotes();
  });

  app.querySelector("[data-rename-note]")?.addEventListener("click", () => {
    renameSelectedNote(selectedNote);
  });

  app.querySelector("[data-delete-note]")?.addEventListener("click", () => {
    deleteSelectedNote(selectedNote);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => {
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
  };

  notes.push(note);
  saveNotes();
  selectedNoteId = note.id;
  currentPage = "edit";
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

function renderNoteCardsOnly(app: HTMLDivElement) {
  const notesGrid = app.querySelector<HTMLDivElement>(".notes-grid");

  if (!notesGrid) {
    return;
  }

  notesGrid.innerHTML = renderNoteCards();

  bindNoteOpenEvents(app);
  bindPinNoteEvents(app);
}

function bindNoteOpenEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLElement>("[data-note-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-pin-note-id]")) {
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
      renderNoteCardsOnly(app);
    });
  });
}

function getSortedNotes(notesToSort: Note[]) {
  return [...notesToSort].sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
    }

    return first.createdAt.getTime() - second.createdAt.getTime();
  });
}

function renameSelectedNote(note: Note) {
  const newTitle = window.prompt("Rename note", note.title)?.trim();

  if (!newTitle) {
    return;
  }

  note.title = newTitle;
  saveNotes();
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

  if (format === "bullet-list") {
    document.execCommand("insertUnorderedList");
  }

  if (format === "numbered-list") {
    document.execCommand("insertOrderedList");
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

    return parsedNotes.map((note) => ({
      ...note,
      createdAt: new Date(note.createdAt),
      pinned: Boolean(note.pinned),
    }));
  } catch {
    return [];
  }
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
    };
  }

  try {
    const parsedSettings = JSON.parse(savedSettings) as Partial<AppSettings>;

    return {
      theme: parsedSettings.theme === "dark" ? "dark" : "light",
      brightness: clampBrightness(parsedSettings.brightness ?? 100),
    };
  } catch {
    return {
      theme: "light",
      brightness: 100,
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
