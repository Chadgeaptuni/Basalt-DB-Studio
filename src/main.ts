import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { theme } from "$lib/stores/theme.svelte";
import { settings } from "$lib/stores/settings.svelte";

// Apply the persisted theme before first paint to avoid a flash of the default.
theme.apply();
// Pull persisted settings (row limit, datetime display); stays on defaults if it
// fails, so a bad settings file never blocks startup.
void settings.load();

const app = mount(App, { target: document.getElementById("app")! });

export default app;
