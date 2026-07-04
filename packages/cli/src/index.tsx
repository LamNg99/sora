import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Header } from "./components/header";

function App() {
  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <Header />
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
