import { createRoot } from "react-dom/client";
import { SaveStatusNotice } from "../../src/components/layout/SaveStatusNotice";
import {
  setStorageUser,
  supabaseStorage,
  flushPendingSaves,
} from "../../src/lib/store/supabaseStorage";
import "../../src/styles.css";

setStorageUser("11111111-1111-4111-8111-111111111111");
const value = await supabaseStorage.getItem("ict-terminal.journal.v1");
createRoot(document.getElementById("root")!).render(
  <main>
    <SaveStatusNotice />
    <p>Loaded: {value}</p>
    <button
      onClick={() => {
        supabaseStorage.setItem("ict-terminal.journal.v1", "my unsaved trade");
        void flushPendingSaves();
      }}
    >
      Save trade
    </button>
  </main>,
);
