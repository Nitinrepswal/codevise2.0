const IS_LOCAL =
  window.location.protocol === "file:" ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const CONFIG = {
  // Local browser usage still talks to the backend on your machine.
  // When hosted on Render, the frontend uses the same origin automatically.
  API_URL: IS_LOCAL ? "http://localhost:5050" : window.location.origin,
};
