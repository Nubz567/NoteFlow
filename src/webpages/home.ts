import "./home.css";

export function renderHomePage() {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    return;
  }

  app.innerHTML = `
    <main class="app-shell">
      <aside class="sidebar">
        <div>
          <p class="eyebrow">NoteFlow</p>
          <h1>Your notes</h1>
          <p class="sidebar-copy">Capture ideas, drafts, and reminders in one calm place.</p>
        </div>

        <button class="create-note-button" type="button">
          Create note
        </button>
      </aside>

      <section class="empty-state" aria-label="Note editor">
        <p class="eyebrow">Editor</p>
        <h2>Select or create a note</h2>
        <p>Your note editor will appear here once we connect the button and note list.</p>
      </section>
    </main>
  `;
}
