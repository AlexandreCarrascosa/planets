export class InputManager {
  constructor(app, ui) {
    window.addEventListener("keydown", (event) => {
      if (document.getElementById("help-dialog").open) return;
      if (event.code === "Escape") {
        app.setTool(null);
        return;
      }
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName) ||
        event.target.isContentEditable
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) ui.togglePause();
      }
      if (event.code === "KeyH") app.overview();
      if (event.code === "KeyF" && app.selected) app.camera.focus(app.selected);
    });
  }
}
