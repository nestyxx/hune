import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/figtree"; // police de l'interface (SIL OFL), embarquée : l'application fonctionne hors ligne
import "@fontsource-variable/newsreader"; // police d'affichage des titres et des grands chiffres (SIL OFL) : chiffres sans ambiguïté
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
