import "./home.css";
import { hasSupabaseConfig, supabase, supabaseConfigError } from "./supabase";

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
  pinned: boolean;
  color: string;
  parentId: string | null;
};

type SlidePage = {
  id: string;
  title: string;
  content: string;
};

type Slide = {
  id: string;
  title: string;
  content: string;
  pages: SlidePage[];
  createdAt: Date;
  pinned: boolean;
  order: number;
  notebookId: string | null;
  color: string;
};

type Page = "auth" | "notes" | "edit" | "slide-edit" | "settings";
type AuthMode = "sign-in" | "sign-up";
type HomeTab = "notes" | "slides";
type SlideContextMenu = {
  pageId: string;
  x: number;
  y: number;
};
type StoredNote = Omit<Note, "createdAt"> & {
  createdAt: string;
};
type StoredNotebook = Omit<Notebook, "createdAt"> & {
  createdAt: string;
};
type StoredSlide = Omit<Slide, "createdAt"> & {
  createdAt: string;
};
type AuthSession = {
  email: string;
};
type ThemeMode = "light" | "dark";
type SortMode = "custom" | "date" | "title" | "random";
type AppSettings = {
  theme: ThemeMode;
  brightness: number;
  sortMode: SortMode;
};

const NOTES_STORAGE_KEY = "noteflow.notes";
const SLIDES_STORAGE_KEY = "noteflow.slides";
const NOTEBOOKS_STORAGE_KEY = "noteflow.notebooks";
const SETTINGS_STORAGE_KEY = "noteflow.settings";
const DEFAULT_NOTE_COLOR = "none";
const DEFAULT_SLIDE_COLOR = "none";
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
const slides: Slide[] = loadSavedSlides();
const notebooks: Notebook[] = loadSavedNotebooks();
let authSession: AuthSession | null = null;
let isTrialSession = false;
let appSettings: AppSettings = loadSavedSettings();
let selectedNoteId: string | null = null;
let selectedSlideId: string | null = null;
let selectedSlidePageId: string | null = null;
let openedNotebookId: string | null = null;
let currentPage: Page = "auth";
let activeHomeTab: HomeTab = "notes";
let authMode: AuthMode = "sign-in";
let authMessage = "";
let accountDeleteMessage = "";
let isDeletingAccount = false;
let hasStartedAuthListener = false;
let searchQuery = "";
let draggedNoteId: string | null = null;
let draggedSlideId: string | null = null;
let dragMoved = false;
let savedEditorSelection: Range | null = null;
let slideContextMenu: SlideContextMenu | null = null;
let slideThumbnailScrollTop = 0;

export function renderHomePage() {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  applyAppSettings();
  startSupabaseAuthListener();
  app.innerHTML = renderCurrentPage();
  bindHomePageEvents(app);
}

function renderCurrentPage() {
  if (!authSession || currentPage === "auth") {
    return renderAuthPage();
  }

  if (currentPage === "edit") {
    return renderEditPage();
  }

  if (currentPage === "slide-edit") {
    return renderSlideEditPage();
  }

  if (currentPage === "settings") {
    return renderSettingsPage();
  }

  return renderNotesPage();
}

function renderAuthPage() {
  const isSignUp = authMode === "sign-up";

  return `
    <main class="auth-page">
      <section class="auth-card glass-shell" aria-label="${isSignUp ? "Create account" : "Sign in"}">
        <div class="auth-heading">
          <p>Welcome to</p>
          <h1>NoteFlow</h1>
        </div>

        <form class="auth-form" data-auth-form>
          <h2>${isSignUp ? "Create your account" : "Sign in"}</h2>
          <p class="auth-description">
            ${
              hasSupabaseConfig
                ? isSignUp
                  ? "Use your email and password to set up your NoteFlow account."
                  : "Sign in with your email and password to open your notes."
                : supabaseConfigError
            }
          </p>

          <label>
            <span>Email</span>
            <input type="email" data-auth-email autocomplete="email" required />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              data-auth-password
              autocomplete="${isSignUp ? "new-password" : "current-password"}"
              required
            />
          </label>

          ${authMessage ? `<p class="auth-message" role="alert">${escapeHtml(authMessage)}</p>` : ""}

          <button class="auth-submit-button" type="submit">
            ${isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <button class="auth-switch-button" type="button" data-auth-switch>
          ${isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>

        <div class="auth-divider" role="separator"><span>or</span></div>

        <button class="auth-trial-button" type="button" data-start-trial>
          Try trial mode
        </button>
        <p class="auth-trial-hint">
          Explore NoteFlow without an account. Notes and slides are not saved. Notebooks and images are unavailable.
        </p>
      </section>
    </main>
  `;
}

function renderNotesPage() {
  const isNotesTab = activeHomeTab === "notes";

  return `
    <main class="notes-page">
      <section class="notes-board glass-shell" aria-label="Your notes">
        <button class="sign-out-button" type="button" data-sign-out>
          ${isTrialSession ? "End trial" : "Sign out"}
        </button>
        <button class="settings-button" type="button" data-open-settings>
          Settings
        </button>

        ${
          isTrialSession
            ? `<p class="trial-banner section-card" role="status">
                Trial mode — notes and slides are not saved. Notebooks and images are unavailable.
              </p>`
            : ""
        }

        <div class="organization-layout ${isTrialSession ? "trial-only-notes" : ""}">
          <section class="organization-panel notes-panel content-panel section-card" aria-label="Workspace">
            <header class="home-tabs" aria-label="Content type">
              <button class="home-tab ${isNotesTab ? "active" : ""}" type="button" data-home-tab="notes">
                Notes
              </button>
              <button class="home-tab ${activeHomeTab === "slides" ? "active" : ""}" type="button" data-home-tab="slides">
                Slides
              </button>
              <button class="home-tab" type="button" disabled title="Coming soon">
                Whiteboards
              </button>
            </header>

            <div
              class="${isNotesTab ? "notes-grid" : "slides-grid"} home-content-grid"
              aria-label="${isNotesTab ? "Unfiled notes" : "Slides"}"
              data-notebook-drop-id=""
            >
              ${isNotesTab ? renderNoteCards() : renderSlideCards()}
            </div>

            <button
              class="create-note-button create-content-button"
              type="button"
              ${isNotesTab ? "data-create-note" : "data-create-slide"}
            >
              New ${isNotesTab ? "note" : "slide"}
            </button>
          </section>

          ${
            isTrialSession
              ? ""
              : `<section class="organization-panel notebooks-section section-card" aria-label="Notebooks">
            <header class="organization-panel-header">
              <h2>Notebooks</h2>
            </header>
            <div class="notebooks-grid">
              ${renderNotebooks()}
            </div>
            <button class="create-notebook-button" type="button" data-create-notebook>
              Create notebook
            </button>
          </section>`
          }
        </div>
        ${renderNotebookPopup()}
      </section>
    </main>
  `;
}

function renderSettingsPage() {
  const pinnedNotesCount = notes.filter((note) => note.pinned).length;

  return `
    <main class="settings-page">
      <section class="settings-board glass-shell" aria-label="Settings">
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
            <p>${slides.length} slide decks</p>
          </article>

          <article class="settings-card">
            <h2>Version</h2>
            <p>NoteFlow 0.1.0</p>
          </article>

          ${
            isTrialSession || !authSession
              ? ""
              : `<article class="settings-card settings-account-card">
            <h2>Account</h2>
            <p>Signed in as ${escapeHtml(authSession.email)}</p>
            <p class="settings-danger-text">
              Permanently delete your NoteFlow account. Your sign-in will be removed. Notes and slides stored on this device will also be cleared.
            </p>
            <button
              class="delete-account-button"
              type="button"
              data-delete-account
              ${isDeletingAccount ? "disabled" : ""}
            >
              ${isDeletingAccount ? "Deleting account..." : "Delete account"}
            </button>
            ${
              accountDeleteMessage
                ? `<p class="settings-account-message" role="alert">${escapeHtml(accountDeleteMessage)}</p>`
                : ""
            }
          </article>`
          }
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

  const noteStats = getNoteContentStats(selectedNote.content);

  return `
    <main class="edit-page">
      <section class="note-editor glass-shell" aria-label="Edit note">
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

            ${
              isTrialSession
                ? ""
                : `<button class="format-button" type="button" data-insert-image>Images</button>
            <input
              class="image-upload-input"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              data-image-upload
            />`
            }
          </div>
        </div>

        ${
          isTrialSession
            ? `<p class="trial-banner editor-trial-banner" role="status">
                Trial mode — this note will not be saved after you end the trial.
              </p>`
            : ""
        }

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
        <div class="editor-counter" data-editor-counter aria-live="polite">
          ${formatNoteContentStats(noteStats)}
        </div>
      </section>
    </main>
  `;
}

function renderSlideEditPage() {
  const selectedSlide = getSelectedSlide();

  if (!selectedSlide) {
    currentPage = "notes";
    return renderNotesPage();
  }

  const selectedPage = getSelectedSlidePage(selectedSlide);

  return `
    <main class="edit-page slide-editor-page">
      <section class="slide-editor glass-shell" aria-label="Edit slide deck">
        <div class="slide-editor-title-card">
          <input
            class="note-title-input ${getNoteTitleSizeClass(selectedSlide.title)}"
            data-slide-title
            maxlength="${MAX_NOTE_TITLE_LENGTH}"
            value="${escapeHtml(selectedSlide.title)}"
            aria-label="Slide title"
          />
        </div>

        <div class="slide-editor-toolbar" aria-label="Slide tools">
          <button class="format-button" type="button" data-create-slide-page>New slide</button>
          <button class="format-button" type="button" data-slide-tool="text-box">Text box</button>
          <button class="format-button" type="button" data-slide-tool="numbered-list">Numbering</button>
          <div class="format-menu">
            <button class="format-button" type="button">Headings</button>
            <div class="format-dropdown">
              <button type="button" data-slide-tool="title">Title</button>
              <button type="button" data-slide-tool="heading">Heading</button>
              <button type="button" data-slide-tool="subheading">Sub heading</button>
            </div>
          </div>
          <button class="format-button" type="button" data-next-slide-page>Next slide</button>
          <button class="format-button filler-button" type="button" disabled>Filler</button>
          <button class="format-button filler-button" type="button" disabled>Filler</button>
          <button class="format-button filler-button" type="button" disabled>Filler</button>
        </div>

        <div class="slide-editor-actions">
          <button class="back-button" type="button" data-back-to-notes>
            Back to home
          </button>
          <button class="rename-note-button" type="button" data-rename-slide>
            Rename
          </button>
        </div>

        <div class="slide-editor-workspace">
          <aside class="slide-thumbnails" aria-label="Slides">
            ${renderSlideThumbnails(selectedSlide)}
          </aside>

          <div
            class="note-content-input slide-canvas"
            data-slide-content
            contenteditable="true"
            role="textbox"
            aria-multiline="true"
            aria-label="Slide content"
            data-placeholder="Start building your slide..."
          >${selectedPage.content}</div>
        </div>
        ${renderSlideContextMenu()}
      </section>
    </main>
  `;
}

function renderSlideThumbnails(slide: Slide) {
  return getSlidePages(slide)
    .map(
      (page, index) => `
        <button
          class="slide-thumbnail ${page.id === getSelectedSlidePage(slide).id ? "active" : ""}"
          type="button"
          data-slide-page-id="${page.id}"
        >
          <span>Slide ${index + 1}</span>
        </button>
      `,
    )
    .join("");
}

function renderSlideContextMenu() {
  if (!slideContextMenu) {
    return "";
  }

  return `
    <div
      class="slide-context-menu"
      style="left: ${slideContextMenu.x}px; top: ${slideContextMenu.y}px;"
      role="menu"
    >
      <button type="button" data-delete-slide-page-id="${escapeHtml(slideContextMenu.pageId)}" role="menuitem">
        Delete slide
      </button>
    </div>
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

function renderSlideCards() {
  if (slides.length === 0) {
    return `
      <div class="empty-notes-message">
        <h2>No slides yet</h2>
        <p>Create your first slide deck to start presenting ideas.</p>
      </div>
    `;
  }

  const matchingSlides = getMatchingSlides().filter((slide) => slide.notebookId === null);

  if (matchingSlides.length === 0) {
    return `
      <div class="empty-notes-message">
        <h2>No matching slides</h2>
        <p>Try a different search.</p>
      </div>
    `;
  }

  return renderSlideCardsForList(matchingSlides);
}

function renderSlideCardsForList(slidesToRender: Slide[]) {
  return slidesToRender
    .map(
      (slide, index) => `
        <article
          class="slide-card slide-card-${(index % 6) + 1} ${slide.pinned ? "pinned" : ""}"
          data-slide-id="${slide.id}"
          data-drag-slide-id="${slide.id}"
          style="background-color: ${getPresetColorValue(slide.color)}; color: ${getContrastColor(slide.color)}"
          role="button"
          tabindex="0"
        >
          <div class="slide-card-preview">
            <span>${escapeHtml(slide.title)}</span>
          </div>
          <button
            class="pin-note-button"
            type="button"
            draggable="false"
            data-pin-slide-id="${slide.id}"
            aria-label="${slide.pinned ? "Unpin" : "Pin"} ${escapeHtml(slide.title)}"
          >
            ${slide.pinned ? "Pinned" : "Pin"}
          </button>
          <div class="color-picker-label">
            <span>Color</span>
            <div class="color-options" aria-label="Choose color for ${escapeHtml(slide.title)}">
              ${renderColorOptions("slide", slide.id, slide.color)}
            </div>
          </div>
          <button
            class="delete-note-button note-card-delete-button"
            type="button"
            draggable="false"
            data-delete-slide-id="${slide.id}"
            aria-label="Delete ${escapeHtml(slide.title)}"
          >
            Delete
          </button>
        </article>
      `,
    )
    .join("");
}

function renderNotebooks(parentId: string | null = null, depth = 0): string {
  if (notebooks.length === 0) {
    return `<p class="empty-notebooks-message">Create a notebook, then drag notes or slides into it.</p>`;
  }

  return notebooks
    .filter((notebook) => notebook.parentId === parentId)
    .sort((first, second) => {
      if (first.pinned !== second.pinned) {
        return first.pinned ? -1 : 1;
      }

      return first.createdAt.getTime() - second.createdAt.getTime();
    })
    .map((notebook) => {
      const notebookNotes = getMatchingNotes().filter((note) => note.notebookId === notebook.id);
      const notebookSlides = getMatchingSlides().filter((slide) => slide.notebookId === notebook.id);
      const hasNotebookItems = notebookNotes.length > 0 || notebookSlides.length > 0;

      return `
        <article
          class="notebook-card nested-notebook-depth-${Math.min(depth, 3)} ${notebook.pinned ? "pinned" : ""}"
          data-notebook-drop-id="${notebook.id}"
          data-open-notebook-id="${notebook.id}"
          style="background-color: ${getPresetColorValue(notebook.color)}; color: ${getContrastColor(notebook.color)}"
          role="button"
          tabindex="0"
        >
          <div class="notebook-card-header">
            <h3>${escapeHtml(notebook.name)}</h3>
            <div class="notebook-card-actions">
              <span>${notebookNotes.length} notes · ${notebookSlides.length} slides</span>
              <button
                class="pin-notebook-button"
                type="button"
                data-pin-notebook-id="${notebook.id}"
                aria-label="${notebook.pinned ? "Unpin" : "Pin"} notebook ${escapeHtml(notebook.name)}"
              >
                ${notebook.pinned ? "Pinned" : "Pin"}
              </button>
              <button
                class="create-sub-notebook-button"
                type="button"
                data-create-sub-notebook-id="${notebook.id}"
                aria-label="Create notebook inside ${escapeHtml(notebook.name)}"
              >
                Sub notebook
              </button>
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
          <p class="notebook-open-hint">${hasNotebookItems ? "Open to view contents" : "Drop notes or slides here"}</p>
        </article>
      `;
    })
    .join("");
}

function renderNotebookPopup() {
  if (!openedNotebookId) {
    return "";
  }

  const notebook = notebooks.find((item) => item.id === openedNotebookId);

  if (!notebook) {
    openedNotebookId = null;
    return "";
  }

  const notebookNotes = getMatchingNotes().filter((note) => note.notebookId === notebook.id);
  const notebookSlides = getMatchingSlides().filter((slide) => slide.notebookId === notebook.id);
  const childNotebooks = renderNotebooks(notebook.id, 1);
  const hasNotebookItems = notebookNotes.length > 0 || notebookSlides.length > 0 || Boolean(childNotebooks);

  return `
    <div class="notebook-popup-backdrop" data-close-notebook-popup>
      <section
        class="notebook-popup glass-shell"
        aria-label="${escapeHtml(notebook.name)} contents"
        role="dialog"
        aria-modal="true"
      >
        <header class="notebook-popup-header">
          <div>
            <p>Notebook</p>
            <h2>${escapeHtml(notebook.name)}</h2>
            <span>${notebookNotes.length} notes · ${notebookSlides.length} slides</span>
          </div>
          <button class="back-button" type="button" data-close-notebook-popup>
            Close
          </button>
        </header>

        <div class="notebook-popup-content" data-notebook-drop-id="${notebook.id}">
          ${
            hasNotebookItems
              ? `
                ${
                  notebookNotes.length > 0
                    ? `<div class="notebook-content-group">
                        <p class="notebook-section-label">Notes</p>
                        <div class="notebook-items-grid">${renderNoteCardsForList(notebookNotes)}</div>
                      </div>`
                    : ""
                }
                ${
                  notebookSlides.length > 0
                    ? `<div class="notebook-content-group">
                        <p class="notebook-section-label">Slides</p>
                        <div class="notebook-items-grid">${renderSlideCardsForList(notebookSlides)}</div>
                      </div>`
                    : ""
                }
                ${
                  childNotebooks
                    ? `<div class="notebook-content-group">
                        <p class="notebook-section-label">Notebooks</p>
                        <div class="notebook-items-grid">${childNotebooks}</div>
                      </div>`
                    : ""
                }
              `
              : `<p class="empty-notebook-message">This notebook is empty. Drag notes or slides here.</p>`
          }
        </div>
      </section>
    </div>
  `;
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
  app.querySelector("[data-auth-switch]")?.addEventListener("click", () => {
    authMode = authMode === "sign-in" ? "sign-up" : "sign-in";
    authMessage = "";
    renderHomePage();
  });

  app.querySelector("[data-start-trial]")?.addEventListener("click", () => {
    startTrialSession();
  });

  app.querySelector<HTMLFormElement>("[data-auth-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const email = form.querySelector<HTMLInputElement>("[data-auth-email]")?.value ?? "";
    const password = form.querySelector<HTMLInputElement>("[data-auth-password]")?.value ?? "";

    if (authMode === "sign-up") {
      await signUpWithEmail(email, password);
    } else {
      await signInWithEmail(email, password);
    }
  });

  if (!authSession) {
    return;
  }

  app.querySelector("[data-sign-out]")?.addEventListener("click", signOut);

  app.querySelector("[data-create-note]")?.addEventListener("click", createNote);
  app.querySelector("[data-create-slide]")?.addEventListener("click", createSlide);
  app.querySelector("[data-create-notebook]")?.addEventListener("click", () => {
    createNotebook();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-home-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeHomeTab = button.dataset.homeTab === "slides" ? "slides" : "notes";
      renderHomePage();
    });
  });

  app.querySelector("[data-open-settings]")?.addEventListener("click", () => {
    accountDeleteMessage = "";
    currentPage = "settings";
    renderHomePage();
  });

  app.querySelector("[data-delete-account]")?.addEventListener("click", () => {
    void deleteAccount();
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
  bindSlideOpenEvents(app);

  bindPinNoteEvents(app);
  bindPinSlideEvents(app);
  bindPinNotebookEvents(app);
  bindDeleteNoteEvents(app);
  bindDeleteSlideEvents(app);
  bindDeleteNotebookEvents(app);
  bindNotebookOpenEvents(app);
  bindDropdownEvents(app);
  bindColorEvents(app);
  bindDragNoteEvents(app);
  bindDragSlideEvents(app);

  app.querySelector("[data-back-to-notes]")?.addEventListener("click", () => {
    currentPage = "notes";
    renderHomePage();
  });

  const selectedSlide = getSelectedSlide();

  if (currentPage === "slide-edit" && selectedSlide) {
    bindSlideEditorEvents(app, selectedSlide);
    return;
  }

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

  app.querySelectorAll<HTMLButtonElement>(".format-toolbar button").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      const editor = app.querySelector<HTMLDivElement>("[data-note-content]");

      if (editor) {
        rememberEditorSelection(editor);
      }

      event.preventDefault();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      applyTextFormatting(button.dataset.format, selectedNote);
      closeDropdowns(app);
    });
  });

  if (!isTrialSession) {
    app.querySelector<HTMLButtonElement>("[data-insert-image]")?.addEventListener("click", () => {
      app.querySelector<HTMLInputElement>("[data-image-upload]")?.click();
    });

    app.querySelector<HTMLInputElement>("[data-image-upload]")?.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement;
      const image = input.files?.[0];

      if (image) {
        insertImageIntoNote(image, selectedNote);
      }

      input.value = "";
    });
  }

  const noteContentEditor = app.querySelector<HTMLDivElement>("[data-note-content]");

  noteContentEditor?.addEventListener("input", (event) => {
    const editor = event.target as HTMLDivElement;

    selectedNote.content = editor.innerHTML;
    rememberEditorSelection(editor);
    saveNotes();
    renderEditorCounter(app, editor.innerHTML);
  });

  noteContentEditor?.addEventListener("keyup", () => {
    rememberEditorSelection(noteContentEditor);
  });

  noteContentEditor?.addEventListener("mouseup", () => {
    rememberEditorSelection(noteContentEditor);
  });

  if (isTrialSession) {
    noteContentEditor?.addEventListener("paste", (event) => {
      const clipboardItems = event.clipboardData?.items;

      if (!clipboardItems) {
        return;
      }

      for (const item of clipboardItems) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          return;
        }
      }
    });
  }
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

function createSlide() {
  const slideNumber = slides.length + 1;
  const slide: Slide = {
    id: crypto.randomUUID(),
    title: `Slide ${slideNumber}`,
    content: "",
    pages: [createSlidePage(1)],
    createdAt: new Date(),
    pinned: false,
    order: getNextSlideOrder(),
    notebookId: null,
    color: DEFAULT_SLIDE_COLOR,
  };

  slides.push(slide);
  saveSlides();
  selectedSlideId = slide.id;
  selectedSlidePageId = slide.pages[0].id;
  activeHomeTab = "slides";
  currentPage = "slide-edit";
  renderHomePage();
}

function createNotebook(parentId: string | null = null) {
  if (isTrialSession) {
    return;
  }

  const parentNotebook = notebooks.find((notebook) => notebook.id === parentId);
  const defaultName = parentNotebook ? `${parentNotebook.name} notebook` : `Notebook ${notebooks.length + 1}`;
  const name = window.prompt(parentNotebook ? `Notebook inside ${parentNotebook.name}` : "Notebook name", defaultName)?.trim();

  if (!name) {
    return;
  }

  notebooks.push({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    pinned: false,
    color: DEFAULT_NOTEBOOK_COLOR,
    parentId,
  });
  saveNotebooks();
  renderHomePage();
}

function getSelectedNote() {
  return notes.find((note) => note.id === selectedNoteId) ?? null;
}

function getSelectedSlide() {
  return slides.find((slide) => slide.id === selectedSlideId) ?? null;
}

function getSlidePages(slide: Slide) {
  if (slide.pages.length === 0) {
    slide.pages.push({
      id: crypto.randomUUID(),
      title: "Slide 1",
      content: slide.content,
    });
  }

  return slide.pages;
}

function getSelectedSlidePage(slide: Slide) {
  const pages = getSlidePages(slide);
  const selectedPage = pages.find((page) => page.id === selectedSlidePageId);

  if (selectedPage) {
    return selectedPage;
  }

  selectedSlidePageId = pages[0].id;
  return pages[0];
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

function getMatchingSlides() {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return getSortedSlides(slides);
  }

  const matchingSlides = slides.filter((slide) => {
    const searchableContent = stripHtml(slide.content).toLowerCase();

    return slide.title.toLowerCase().includes(normalizedQuery) || searchableContent.includes(normalizedQuery);
  });

  return getSortedSlides(matchingSlides);
}

function renderNotesCollectionsOnly(app: HTMLDivElement) {
  if (openedNotebookId) {
    renderHomePage();
    return;
  }

  const notesGrid = app.querySelector<HTMLDivElement>(".notes-grid");
  const slidesGrid = app.querySelector<HTMLDivElement>(".slides-grid");
  const notebooksGrid = app.querySelector<HTMLDivElement>(".notebooks-grid");

  if (notesGrid) {
    notesGrid.innerHTML = renderNoteCards();
  }

  if (slidesGrid) {
    slidesGrid.innerHTML = renderSlideCards();
  }

  if (notebooksGrid) {
    notebooksGrid.innerHTML = renderNotebooks();
  }

  bindNoteOpenEvents(app);
  bindSlideOpenEvents(app);
  bindPinNoteEvents(app);
  bindPinSlideEvents(app);
  bindPinNotebookEvents(app);
  bindDeleteNoteEvents(app);
  bindDeleteSlideEvents(app);
  bindCreateSubNotebookEvents(app);
  bindDeleteNotebookEvents(app);
  bindNotebookOpenEvents(app);
  bindDropdownEvents(app);
  bindColorEvents(app);
  bindDragNoteEvents(app);
  bindDragSlideEvents(app);
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

function bindSlideOpenEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLElement>("[data-slide-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-pin-slide-id], [data-delete-slide-id], .color-picker-label")) {
        return;
      }

      openSlide(card.dataset.slideId ?? null);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openSlide(card.dataset.slideId ?? null);
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

function bindDragSlideEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLElement>("[data-drag-slide-id]").forEach((card) => {
    card.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest("[data-pin-slide-id], [data-delete-slide-id], .color-picker-label")) {
        return;
      }

      draggedSlideId = card.dataset.dragSlideId ?? null;

      if (!draggedSlideId) {
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
          dropPointerDraggedSlide(app, upEvent.clientX, upEvent.clientY);
        }

        clearDropTargets(app);
        draggedSlideId = null;
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
  const targetSlideCard = target?.closest<HTMLElement>("[data-drag-slide-id]");
  const targetNotebook = target?.closest<HTMLElement>("[data-notebook-drop-id]");

  if (targetCard && targetCard.dataset.dragNoteId !== draggedNoteId) {
    targetCard.classList.add("drop-target");
    return;
  }

  if (targetSlideCard && targetSlideCard.dataset.dragSlideId !== draggedSlideId) {
    targetSlideCard.classList.add("drop-target");
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

function dropPointerDraggedSlide(app: HTMLDivElement, clientX: number, clientY: number) {
  const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const targetCard = target?.closest<HTMLElement>("[data-drag-slide-id]");
  const targetNotebook = target?.closest<HTMLElement>("[data-notebook-drop-id]");

  if (targetCard && targetCard.dataset.dragSlideId !== draggedSlideId) {
    reorderSlide(draggedSlideId, targetCard.dataset.dragSlideId ?? null);
    renderNotesCollectionsOnly(app);
    return;
  }

  if (targetNotebook) {
    moveSlideToNotebook(draggedSlideId, targetNotebook.dataset.notebookDropId || null);
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

function reorderSlide(sourceSlideId: string | null, targetSlideId: string | null) {
  if (!sourceSlideId || !targetSlideId || sourceSlideId === targetSlideId) {
    return;
  }

  const sortedSlides = getSortedSlides(slides);
  const sourceIndex = sortedSlides.findIndex((slide) => slide.id === sourceSlideId);
  const targetIndex = sortedSlides.findIndex((slide) => slide.id === targetSlideId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

  const [movedSlide] = sortedSlides.splice(sourceIndex, 1);
  movedSlide.notebookId = sortedSlides[targetIndex]?.notebookId ?? null;
  sortedSlides.splice(targetIndex, 0, movedSlide);

  sortedSlides.forEach((slide, index) => {
    slide.order = index;
  });

  saveSlides();
}

function clearDropTargets(app: HTMLDivElement) {
  app.querySelectorAll(".drop-target").forEach((target) => {
    target.classList.remove("drop-target");
  });
}

function moveNoteToNotebook(noteId: string | null, notebookId: string | null) {
  if (isTrialSession) {
    return;
  }

  const note = notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  note.notebookId = notebookId;
  saveNotes();
}

function moveSlideToNotebook(slideId: string | null, notebookId: string | null) {
  if (isTrialSession) {
    return;
  }

  const slide = slides.find((item) => item.id === slideId);

  if (!slide) {
    return;
  }

  slide.notebookId = notebookId;
  saveSlides();
}

function openNote(noteId: string | null) {
  selectedNoteId = noteId;
  currentPage = "edit";
  renderHomePage();
}

function openSlide(slideId: string | null) {
  selectedSlideId = slideId;
  const slide = slides.find((item) => item.id === slideId);
  selectedSlidePageId = slide ? getSlidePages(slide)[0].id : null;
  activeHomeTab = "slides";
  currentPage = "slide-edit";
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

function bindPinSlideEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-pin-slide-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const slide = slides.find((item) => item.id === button.dataset.pinSlideId);

      if (!slide) {
        return;
      }

      slide.pinned = !slide.pinned;
      saveSlides();
      renderNotesCollectionsOnly(app);
    });
  });
}

function bindPinNotebookEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-pin-notebook-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const notebook = notebooks.find((item) => item.id === button.dataset.pinNotebookId);

      if (!notebook) {
        return;
      }

      notebook.pinned = !notebook.pinned;
      saveNotebooks();
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

function bindDeleteSlideEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-delete-slide-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const slide = slides.find((item) => item.id === button.dataset.deleteSlideId);

      if (!slide) {
        return;
      }

      deleteSelectedSlide(slide);
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

function bindNotebookOpenEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLElement>("[data-open-notebook-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (dragMoved) {
        return;
      }

      if (
        (event.target as HTMLElement).closest(
          "[data-pin-notebook-id], [data-create-sub-notebook-id], [data-delete-notebook-id], .color-picker-label",
        )
      ) {
        return;
      }

      openedNotebookId = card.dataset.openNotebookId ?? null;
      renderHomePage();
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openedNotebookId = card.dataset.openNotebookId ?? null;
      renderHomePage();
    });
  });

  app.querySelectorAll("[data-close-notebook-popup]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.currentTarget !== event.target && !(event.target as HTMLElement).closest("button")) {
        return;
      }

      openedNotebookId = null;
      renderHomePage();
    });
  });
}

function bindDropdownEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>(".format-menu > .format-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = button.closest<HTMLElement>(".format-menu");

      if (!menu) {
        return;
      }

      closeDropdowns(app, menu);
      menu.classList.toggle("open");
    });
  });

  app.querySelectorAll<HTMLElement>(".color-picker-label").forEach((picker) => {
    picker.addEventListener("click", (event) => {
      event.stopPropagation();
      closeDropdowns(app, picker);
      picker.classList.toggle("open");
    });
  });

  app.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    if (target.closest(".format-menu, .color-picker-label")) {
      return;
    }

    closeDropdowns(app);
  });
}

function closeDropdowns(app: HTMLDivElement, except?: HTMLElement) {
  app.querySelectorAll<HTMLElement>(".format-menu.open, .color-picker-label.open").forEach((dropdown) => {
    if (dropdown === except) {
      return;
    }

    dropdown.classList.remove("open");
  });
}

function bindCreateSubNotebookEvents(app: HTMLDivElement) {
  app.querySelectorAll<HTMLButtonElement>("[data-create-sub-notebook-id]").forEach((button) => {
    button.addEventListener("click", () => {
      createNotebook(button.dataset.createSubNotebookId ?? null);
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

  app.querySelectorAll<HTMLButtonElement>("[data-slide-color-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const slide = slides.find((item) => item.id === button.dataset.slideColorId);

      if (!slide) {
        return;
      }

      slide.color = getPresetColorId(button.dataset.colorValue);
      saveSlides();
      renderNotesCollectionsOnly(app);
    });
  });
}

function deleteNotebook(notebook: Notebook) {
  const descendantIds = getNotebookDescendantIds(notebook.id);
  const notebookIdsToDelete = [notebook.id, ...descendantIds];
  const shouldDelete = window.confirm(
    `Delete notebook "${notebook.name}"${descendantIds.length > 0 ? " and its sub-notebooks" : ""}? Notes inside will move back to Notes.`,
  );

  if (!shouldDelete) {
    return;
  }

  for (const notebookId of notebookIdsToDelete) {
    const notebookIndex = notebooks.findIndex((item) => item.id === notebookId);

    if (notebookIndex !== -1) {
      notebooks.splice(notebookIndex, 1);
    }
  }

  if (openedNotebookId && notebookIdsToDelete.includes(openedNotebookId)) {
    openedNotebookId = null;
  }

  notes.forEach((note) => {
    if (note.notebookId && notebookIdsToDelete.includes(note.notebookId)) {
      note.notebookId = null;
    }
  });

  slides.forEach((slide) => {
    if (slide.notebookId && notebookIdsToDelete.includes(slide.notebookId)) {
      slide.notebookId = null;
    }
  });

  saveNotebooks();
  saveNotes();
  saveSlides();
  renderHomePage();
}

function getNotebookDescendantIds(parentId: string): string[] {
  const childIds = notebooks.filter((notebook) => notebook.parentId === parentId).map((notebook) => notebook.id);

  return childIds.flatMap((childId) => [childId, ...getNotebookDescendantIds(childId)]);
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

function getSortedSlides(slidesToSort: Slide[]) {
  return [...slidesToSort].sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
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

function renameSelectedSlide(slide: Slide) {
  const newTitle = normalizeNoteTitle(window.prompt("Rename slide", slide.title) ?? "");

  if (!newTitle) {
    return;
  }

  slide.title = newTitle;
  saveSlides();
  renderHomePage();
}

function createSlidePage(pageNumber: number): SlidePage {
  return {
    id: crypto.randomUUID(),
    title: `Slide ${pageNumber}`,
    content: "",
  };
}

function addSlidePage(slide: Slide) {
  const newPage = createSlidePage(getSlidePages(slide).length + 1);

  slide.pages.push(newPage);
  selectedSlidePageId = newPage.id;
  slideThumbnailScrollTop = Number.MAX_SAFE_INTEGER;
  slideContextMenu = null;
  syncSlideDeckContent(slide);
  saveSlides();
  renderHomePage();
}

function selectSlidePage(pageId: string) {
  selectedSlidePageId = pageId;
  slideContextMenu = null;
  renderHomePage();
}

function selectNextSlidePage(slide: Slide) {
  const pages = getSlidePages(slide);
  const currentIndex = pages.findIndex((page) => page.id === selectedSlidePageId);
  const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, pages.length - 1);

  selectedSlidePageId = pages[nextIndex].id;
  slideContextMenu = null;
  renderHomePage();
}

function rememberSlideThumbnailScroll(app: HTMLDivElement) {
  slideThumbnailScrollTop = app.querySelector<HTMLElement>(".slide-thumbnails")?.scrollTop ?? slideThumbnailScrollTop;
}

function restoreSlideThumbnailScroll(app: HTMLDivElement) {
  const slideThumbnails = app.querySelector<HTMLElement>(".slide-thumbnails");

  if (!slideThumbnails) {
    return;
  }

  slideThumbnails.scrollTop = slideThumbnailScrollTop;
}

function deleteSlidePage(slide: Slide, pageId: string) {
  const pages = getSlidePages(slide);

  if (pages.length <= 1) {
    slideContextMenu = null;
    window.alert("A slide deck needs at least one slide.");
    renderHomePage();
    return;
  }

  const pageIndex = pages.findIndex((page) => page.id === pageId);

  if (pageIndex === -1) {
    slideContextMenu = null;
    renderHomePage();
    return;
  }

  const shouldDelete = window.confirm(`Delete Slide ${pageIndex + 1}?`);

  if (!shouldDelete) {
    slideContextMenu = null;
    renderHomePage();
    return;
  }

  pages.splice(pageIndex, 1);
  selectedSlidePageId = pages[Math.min(pageIndex, pages.length - 1)].id;
  slideContextMenu = null;
  syncSlideDeckContent(slide);
  saveSlides();
  renderHomePage();
}

function syncSlideDeckContent(slide: Slide) {
  slide.content = getSlidePages(slide)
    .map((page) => page.content)
    .join(" ");
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

function deleteSelectedSlide(slide: Slide) {
  const shouldDelete = window.confirm(`Delete "${slide.title}"?`);

  if (!shouldDelete) {
    return;
  }

  const slideIndex = slides.findIndex((item) => item.id === slide.id);

  if (slideIndex === -1) {
    return;
  }

  slides.splice(slideIndex, 1);
  saveSlides();
  selectedSlideId = null;
  selectedSlidePageId = null;
  activeHomeTab = "slides";
  currentPage = "notes";
  renderHomePage();
}

function bindSlideEditorEvents(app: HTMLDivElement, selectedSlide: Slide) {
  const selectedPage = getSelectedSlidePage(selectedSlide);
  restoreSlideThumbnailScroll(app);

  app.querySelector<HTMLElement>(".slide-thumbnails")?.addEventListener("scroll", () => {
    rememberSlideThumbnailScroll(app);
  });

  app.querySelector<HTMLInputElement>("[data-slide-title]")?.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    const title = limitNoteTitle(input.value);

    if (input.value !== title) {
      input.value = title;
    }

    selectedSlide.title = title || "Untitled slide";
    updateNoteTitleSize(input);
    saveSlides();
  });

  app.querySelector("[data-rename-slide]")?.addEventListener("click", () => {
    renameSelectedSlide(selectedSlide);
  });

  app.querySelector("[data-create-slide-page]")?.addEventListener("click", () => {
    addSlidePage(selectedSlide);
  });

  app.querySelector("[data-next-slide-page]")?.addEventListener("click", () => {
    rememberSlideThumbnailScroll(app);
    selectNextSlidePage(selectedSlide);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-slide-page-id]").forEach((button) => {
    button.addEventListener("click", () => {
      rememberSlideThumbnailScroll(app);
      slideContextMenu = null;
      selectSlidePage(button.dataset.slidePageId ?? "");
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      rememberSlideThumbnailScroll(app);
      slideContextMenu = {
        pageId: button.dataset.slidePageId ?? "",
        x: event.clientX,
        y: event.clientY,
      };
      renderHomePage();
    });
  });

  app.querySelector("[data-delete-slide-page-id]")?.addEventListener("click", () => {
    deleteSlidePage(selectedSlide, slideContextMenu?.pageId ?? "");
  });

  app.addEventListener("click", (event) => {
    if (!slideContextMenu) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest(".slide-context-menu")) {
      return;
    }

    rememberSlideThumbnailScroll(app);
    slideContextMenu = null;
    renderHomePage();
  });

  app.querySelectorAll<HTMLButtonElement>(".slide-editor-toolbar button").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      const editor = app.querySelector<HTMLDivElement>("[data-slide-content]");

      if (editor) {
        rememberEditorSelection(editor);
      }

      event.preventDefault();
    });
  });

  app.querySelectorAll<HTMLButtonElement>("[data-slide-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      applySlideTool(button.dataset.slideTool, selectedSlide);
      closeDropdowns(app);
    });
  });

  app.querySelector<HTMLDivElement>("[data-slide-content]")?.addEventListener("input", (event) => {
    const editor = event.target as HTMLDivElement;

    selectedPage.content = editor.innerHTML;
    syncSlideDeckContent(selectedSlide);
    rememberEditorSelection(editor);
    saveSlides();
  });

  app.querySelector<HTMLDivElement>("[data-slide-content]")?.addEventListener("keyup", (event) => {
    rememberEditorSelection(event.currentTarget as HTMLDivElement);
  });

  app.querySelector<HTMLDivElement>("[data-slide-content]")?.addEventListener("mouseup", (event) => {
    rememberEditorSelection(event.currentTarget as HTMLDivElement);
  });

  bindSlideTextBoxDragEvents(app, selectedSlide);
}

function bindSlideTextBoxDragEvents(app: HTMLDivElement, selectedSlide: Slide) {
  const canvas = app.querySelector<HTMLDivElement>("[data-slide-content]");

  if (!canvas) {
    return;
  }

  canvas.querySelectorAll<HTMLElement>(".slide-text-box").forEach((textBox) => {
    const draggableTextBox = textBox as HTMLElement & { noteflowDragBound?: boolean };

    if (draggableTextBox.noteflowDragBound) {
      return;
    }

    draggableTextBox.noteflowDragBound = true;
    textBox.removeAttribute("data-drag-bound");
    textBox.setAttribute("contenteditable", "true");

    textBox.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const canvasRect = canvas.getBoundingClientRect();
      const textBoxRect = textBox.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = textBoxRect.left - canvasRect.left + canvas.scrollLeft;
      const startTop = textBoxRect.top - canvasRect.top + canvas.scrollTop;
      let didDrag = false;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        if (!didDrag && Math.abs(deltaX) + Math.abs(deltaY) < 4) {
          return;
        }

        didDrag = true;
        moveEvent.preventDefault();
        textBox.classList.add("dragging-text-box");

        const maxLeft = Math.max(0, canvas.scrollWidth - textBox.offsetWidth);
        const maxTop = Math.max(0, canvas.scrollHeight - textBox.offsetHeight);
        const nextLeft = Math.min(maxLeft, Math.max(0, startLeft + deltaX));
        const nextTop = Math.min(maxTop, Math.max(0, startTop + deltaY));

        textBox.style.left = `${Math.round(nextLeft)}px`;
        textBox.style.top = `${Math.round(nextTop)}px`;
      };

      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        textBox.classList.remove("dragging-text-box");

        if (didDrag) {
          const selectedPage = getSelectedSlidePage(selectedSlide);
          selectedPage.content = canvas.innerHTML;
          syncSlideDeckContent(selectedSlide);
          saveSlides();
        }
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp, { once: true });
    });
  });
}

function rememberEditorSelection(editor: HTMLDivElement) {
  const selection = document.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);

  if (!editor.contains(range.commonAncestorContainer)) {
    return;
  }

  savedEditorSelection = range.cloneRange();
}

function restoreEditorSelection(editor: HTMLDivElement) {
  const selection = document.getSelection();

  if (!selection || !savedEditorSelection || !editor.contains(savedEditorSelection.commonAncestorContainer)) {
    return false;
  }

  selection.removeAllRanges();
  selection.addRange(savedEditorSelection);
  return true;
}

function applyTextFormatting(format: string | undefined, note: Note) {
  const editor = document.querySelector<HTMLDivElement>("[data-note-content]");

  if (!editor) {
    return;
  }

  editor.focus();
  restoreEditorSelection(editor);

  if (format === "bold") {
    document.execCommand("bold");
  }

  if (format === "italic") {
    document.execCommand("italic");
  }

  if (format === "heading") {
    applyTextSizeFormatting("heading", editor);
  }

  if (format === "subheading") {
    applyTextSizeFormatting("subheading", editor);
  }

  if (format === "title") {
    applyTextSizeFormatting("title", editor);
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
  rememberEditorSelection(editor);
  saveNotes();
}

function applySlideTool(tool: string | undefined, slide: Slide) {
  const editor = document.querySelector<HTMLDivElement>("[data-slide-content]");
  const selectedPage = getSelectedSlidePage(slide);

  if (!editor) {
    return;
  }

  editor.focus();
  restoreEditorSelection(editor);

  if (tool === "text-box") {
    document.execCommand(
      "insertHTML",
      false,
      `<div class="slide-text-box" contenteditable="true" style="left: 48px; top: 48px;">Text box</div>`,
    );
  }

  if (tool === "numbered-list") {
    document.execCommand("insertOrderedList");
  }

  if (tool === "heading") {
    applyTextSizeFormatting("heading", editor);
  }

  if (tool === "subheading") {
    applyTextSizeFormatting("subheading", editor);
  }

  if (tool === "title") {
    applyTextSizeFormatting("title", editor);
  }

  selectedPage.content = editor.innerHTML;
  syncSlideDeckContent(slide);
  rememberEditorSelection(editor);
  saveSlides();
  const app = document.querySelector<HTMLDivElement>("#app");

  if (app) {
    bindSlideTextBoxDragEvents(app, slide);
  }
}

function applyTextSizeFormatting(size: "title" | "heading" | "subheading", editor: HTMLDivElement) {
  const selection = document.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);

  if (!editor.contains(range.commonAncestorContainer)) {
    return;
  }

  if (!range.toString().trim()) {
    return;
  }

  const wrapper = document.createElement("span");
  const selectedContent = range.extractContents();

  wrapper.className = `editor-text-size editor-text-${size}`;
  wrapper.append(selectedContent);

  range.insertNode(wrapper);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection.addRange(nextRange);
  savedEditorSelection = nextRange.cloneRange();
}

function insertImageIntoNote(image: File, note: Note) {
  if (isTrialSession) {
    return;
  }

  if (!image.type.startsWith("image/")) {
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    const imageSource = String(reader.result ?? "");
    const editor = document.querySelector<HTMLDivElement>("[data-note-content]");

    if (!editor || !imageSource) {
      return;
    }

    editor.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<figure><img src="${escapeHtml(imageSource)}" alt="${escapeHtml(image.name)}" /><figcaption>${escapeHtml(
        image.name,
      )}</figcaption></figure>`,
    );
    note.content = editor.innerHTML;
    saveNotes();
    renderEditorCounter(document.querySelector<HTMLDivElement>("#app"), editor.innerHTML);
  });

  reader.readAsDataURL(image);
}

function renderEditorCounter(app: HTMLDivElement | null, content: string) {
  const counter = app?.querySelector<HTMLElement>("[data-editor-counter]");

  if (!counter) {
    return;
  }

  counter.textContent = formatNoteContentStats(getNoteContentStats(content));
}

function getNoteContentStats(content: string) {
  const text = stripHtml(content).trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    words,
    characters: text.length,
  };
}

function formatNoteContentStats(stats: { words: number; characters: number }) {
  return `${stats.words} ${stats.words === 1 ? "word" : "words"} | ${stats.characters} ${
    stats.characters === 1 ? "character" : "characters"
  }`;
}

async function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    authMessage = supabaseConfigError;
    renderHomePage();
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const validationMessage = validateAuthCredentials(normalizedEmail, password);

  if (validationMessage) {
    authMessage = validationMessage;
    renderHomePage();
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
  });

  if (error) {
    authMessage = getAuthErrorMessage(error.message);
    renderHomePage();
    return;
  }

  if (!data.session) {
    authMessage = "Account created. Check your email to confirm your account, then sign in.";
    authMode = "sign-in";
    renderHomePage();
    return;
  }

  setAuthSessionFromEmail(data.user?.email ?? normalizedEmail);
  renderHomePage();
}

async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    authMessage = supabaseConfigError;
    renderHomePage();
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const validationMessage = validateAuthCredentials(normalizedEmail, password);

  if (validationMessage) {
    authMessage = validationMessage;
    renderHomePage();
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    authMessage = getAuthErrorMessage(error.message);
    renderHomePage();
    return;
  }

  setAuthSessionFromEmail(data.user.email ?? normalizedEmail);
  renderHomePage();
}

async function signOut() {
  if (isTrialSession) {
    endTrialSession();
    return;
  }

  await supabase?.auth.signOut();
  authSession = null;
  selectedNoteId = null;
  selectedSlideId = null;
  selectedSlidePageId = null;
  activeHomeTab = "notes";
  currentPage = "auth";
  authMode = "sign-in";
  authMessage = "";
  accountDeleteMessage = "";
  renderHomePage();
}

async function deleteAccount() {
  if (isTrialSession || !authSession || !supabase || isDeletingAccount) {
    return;
  }

  const confirmed = window.confirm(
    "Delete your NoteFlow account permanently?\n\nYour sign-in will be removed and you cannot undo this. Notes, slides, and notebooks on this device will also be cleared.",
  );

  if (!confirmed) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? authSession.email;

  const password = window.prompt(`Enter your password for ${email} to confirm account deletion:`);

  if (!password) {
    accountDeleteMessage = "Account deletion cancelled.";
    renderHomePage();
    return;
  }

  isDeletingAccount = true;
  accountDeleteMessage = "";
  renderHomePage();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    isDeletingAccount = false;
    accountDeleteMessage = "Incorrect password. Your account was not deleted.";
    renderHomePage();
    return;
  }

  const deleteErrorMessage = await requestAccountDeletion();

  if (deleteErrorMessage) {
    isDeletingAccount = false;
    accountDeleteMessage = deleteErrorMessage;
    renderHomePage();
    return;
  }

  clearLocalAppData();
  await supabase.auth.signOut();
  authSession = null;
  isTrialSession = false;
  isDeletingAccount = false;
  selectedNoteId = null;
  selectedSlideId = null;
  selectedSlidePageId = null;
  activeHomeTab = "notes";
  searchQuery = "";
  currentPage = "auth";
  authMode = "sign-in";
  authMessage = "";
  accountDeleteMessage = "";
  renderHomePage();
}

async function requestAccountDeletion() {
  if (!supabase) {
    return "Supabase is not configured.";
  }

  const { error: rpcError } = await supabase.rpc("delete_own_account");

  if (!rpcError) {
    return null;
  }

  if (!isMissingAccountDeletionSetup(rpcError.message, rpcError.code)) {
    return getDeleteAccountErrorMessage(rpcError.message, rpcError.code);
  }

  const { data, error: functionError } = await supabase.functions.invoke("delete-account");

  if (functionError) {
    return getDeleteAccountErrorMessage(functionError.message, functionError.name);
  }

  if (data && typeof data === "object" && "error" in data) {
    const functionResponseError = (data as { error?: string }).error;

    if (functionResponseError) {
      return getDeleteAccountErrorMessage(functionResponseError);
    }
  }

  return null;
}

function isMissingAccountDeletionSetup(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();
  const normalizedCode = code?.toLowerCase() ?? "";

  return (
    normalizedCode === "pgrst202" ||
    normalizedMessage.includes("could not find the function") ||
    normalizedMessage.includes("function public.delete_own_account") ||
    normalizedMessage.includes("schema cache")
  );
}

function clearLocalAppData() {
  localStorage.removeItem(NOTES_STORAGE_KEY);
  localStorage.removeItem(SLIDES_STORAGE_KEY);
  localStorage.removeItem(NOTEBOOKS_STORAGE_KEY);
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  notes.splice(0, notes.length);
  slides.splice(0, slides.length);
  notebooks.splice(0, notebooks.length);
  appSettings = {
    theme: "light",
    brightness: 100,
    sortMode: "custom",
  };
  applyAppSettings();
}

function getDeleteAccountErrorMessage(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (isMissingAccountDeletionSetup(message, code)) {
    return "Account deletion is not set up yet. In Supabase Dashboard → SQL Editor, paste and run the full script from supabase/delete_own_account.sql, then wait 30 seconds and try again.";
  }

  if (
    normalizedMessage.includes("failed to send a request to the edge function") ||
    normalizedMessage.includes("function not found") ||
    normalizedMessage.includes("404")
  ) {
    return "Account deletion is not set up yet. Run supabase/delete_own_account.sql in the SQL Editor, or deploy supabase/functions/delete-account with the Supabase CLI.";
  }

  if (normalizedMessage.includes("not authenticated")) {
    return "Your session expired. Sign in again, then try deleting your account.";
  }

  if (normalizedMessage.includes("permission denied")) {
    return "Account deletion failed (permission denied). Run the updated supabase/delete_own_account.sql in your Supabase SQL Editor, then try again.";
  }

  if (normalizedMessage.includes("storage") && normalizedMessage.includes("owner")) {
    return "This account owns files in Supabase Storage. Remove those files in the Supabase dashboard, then try again.";
  }

  if (code) {
    return `${message} (${code})`;
  }

  return message;
}

function startTrialSession() {
  isTrialSession = true;
  authSession = { email: "trial@noteflow.local" };
  authMessage = "";
  notes.splice(0, notes.length);
  slides.splice(0, slides.length);
  notebooks.splice(0, notebooks.length);
  selectedNoteId = null;
  selectedSlideId = null;
  selectedSlidePageId = null;
  activeHomeTab = "notes";
  searchQuery = "";
  currentPage = "notes";
  renderHomePage();
}

function endTrialSession() {
  isTrialSession = false;
  authSession = null;
  reloadPersistedData();
  selectedNoteId = null;
  selectedSlideId = null;
  selectedSlidePageId = null;
  activeHomeTab = "notes";
  searchQuery = "";
  currentPage = "auth";
  authMode = "sign-in";
  authMessage = "";
  renderHomePage();
}

function reloadPersistedData() {
  const savedNotes = loadSavedNotes();
  notes.splice(0, notes.length, ...savedNotes);
  const savedSlides = loadSavedSlides();
  slides.splice(0, slides.length, ...savedSlides);
  const savedNotebooks = loadSavedNotebooks();
  notebooks.splice(0, notebooks.length, ...savedNotebooks);
}

function validateAuthCredentials(email: string, password: string) {
  if (!email || !email.includes("@")) {
    return "Enter a valid email address.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  return "";
}

function getAuthErrorMessage(message: string) {
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Could not reach Supabase. Check that VITE_SUPABASE_URL is your Project URL, not the dashboard URL, then restart the app.";
  }

  return message;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function setAuthSessionFromEmail(email: string) {
  if (isTrialSession) {
    isTrialSession = false;
    reloadPersistedData();
  }

  authSession = { email: normalizeEmail(email) };
  authMessage = "";
  currentPage = "notes";
}

function startSupabaseAuthListener() {
  if (hasStartedAuthListener || !supabase) {
    return;
  }

  hasStartedAuthListener = true;

  supabase.auth.getSession().then(({ data }) => {
    const email = data.session?.user.email;

    if (email) {
      setAuthSessionFromEmail(email);
      renderHomePage();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const email = session?.user.email;

    if (email) {
      setAuthSessionFromEmail(email);
      renderHomePage();
      return;
    }

    if (isTrialSession) {
      return;
    }

    authSession = null;
    currentPage = "auth";
    renderHomePage();
  });
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

function loadSavedSlides() {
  const savedSlides = localStorage.getItem(SLIDES_STORAGE_KEY);

  if (!savedSlides) {
    return [];
  }

  try {
    const parsedSlides = JSON.parse(savedSlides) as StoredSlide[];

    return parsedSlides.map((slide, index) => {
      const pages = Array.isArray(slide.pages)
        ? slide.pages.map((page, pageIndex) => ({
            id: typeof page.id === "string" ? page.id : crypto.randomUUID(),
            title: normalizeNoteTitle(page.title) || `Slide ${pageIndex + 1}`,
            content: typeof page.content === "string" ? page.content : "",
          }))
        : [];
      const normalizedPages =
        pages.length > 0
          ? pages
          : [
              {
                id: crypto.randomUUID(),
                title: "Slide 1",
                content: typeof slide.content === "string" ? slide.content : "",
              },
            ];

      return {
        ...slide,
        title: normalizeNoteTitle(slide.title) || "Untitled slide",
        content: normalizedPages.map((page) => page.content).join(" "),
        pages: normalizedPages,
        createdAt: new Date(slide.createdAt),
        pinned: Boolean(slide.pinned),
        order: typeof slide.order === "number" ? slide.order : index,
        notebookId: typeof slide.notebookId === "string" ? slide.notebookId : null,
        color: getPresetColorId(slide.color),
      };
    });
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
      pinned: Boolean(notebook.pinned),
      color: getPresetColorId(notebook.color),
      parentId: typeof notebook.parentId === "string" ? notebook.parentId : null,
    }));
  } catch {
    return [];
  }
}

function saveNotebooks() {
  if (isTrialSession) {
    return;
  }

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

function getNextSlideOrder() {
  if (slides.length === 0) {
    return 0;
  }

  return Math.max(...slides.map((slide) => slide.order)) + 1;
}

function saveNotes() {
  if (isTrialSession) {
    return;
  }

  const notesToStore: StoredNote[] = notes.map((note) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
  }));

  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesToStore));
}

function saveSlides() {
  if (isTrialSession) {
    return;
  }

  const slidesToStore: StoredSlide[] = slides.map((slide) => ({
    ...slide,
    createdAt: slide.createdAt.toISOString(),
  }));

  localStorage.setItem(SLIDES_STORAGE_KEY, JSON.stringify(slidesToStore));
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
  if (isTrialSession) {
    return;
  }

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

function getStableRandomValue(value: string) {
  return [...value].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) % 100000;
  }, 7);
}

function renderColorOptions(targetType: "note" | "notebook" | "slide", targetId: string, selectedColor: string) {
  const selectedPreset = getPresetColorId(selectedColor);

  return COLOR_PRESETS.map((preset) => {
    const dataAttribute =
      targetType === "note"
        ? `data-note-color-id="${targetId}"`
        : targetType === "slide"
          ? `data-slide-color-id="${targetId}"`
          : `data-notebook-color-id="${targetId}"`;
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
